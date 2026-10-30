import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatLookupForPrompt, runPharmacyLookup, type LookupResult } from './index';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/**
 * Stubs the network the pipeline touches. The shortage feed answers "Discontinued" if anything asks it,
 * as it did for vancomycin when one manufacturer's product was discontinued.
 */
function stubNetwork() {
  const requested: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      if (url.includes('/api/ai/classify')) {
        return json({ drug_names: ['vancomycin'], query_domain: 'iv_drug_info', urgency: 'routine' });
      }
      if (url.includes('drug/shortages')) {
        return json({ results: [{ generic_name: 'vancomycin', status: 'Discontinued', reason: 'One product discontinued' }] });
      }
      if (url.includes('drug/label')) {
        return json({
          results: [
            {
              set_id: '3b6b2a1e-0c4f-4f1e-9d4f-2d9c3f1a7b10',
              openfda: { manufacturer_name: ['Example Pharma'], rxcui: ['11124'], application_number: ['ANDA062911', 'ANDA062912'] },
              dosage_and_administration: ['Infuse over at least 60 minutes at a rate no greater than 10 mg/min.'],
            },
          ],
        });
      }
      return new Response('not found', { status: 404 });
    }),
  );
  return requested;
}

describe('runPharmacyLookup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never asks the openFDA shortage feed, so one discontinued product cannot label the whole drug', async () => {
    const requested = stubNetwork();
    const result = await runPharmacyLookup('Max infusion rate for vancomycin?');

    expect(requested.some((u) => u.includes('drug/label'))).toBe(true);
    expect(requested.some((u) => /shortage/i.test(u))).toBe(false);
    expect(result.drug_lookups).toHaveLength(1);
    expect(result.drug_lookups[0].label_sections.length).toBeGreaterThan(0);
    expect(result.drug_lookups[0]).not.toHaveProperty('shortage');
  });

  it('produces no shortage safety flags and does not list the shortage source', async () => {
    stubNetwork();
    const result = await runPharmacyLookup('Max infusion rate for vancomycin?');

    expect(result.safety_flags.filter((f) => (f.category as string) === 'shortage')).toEqual([]);
    expect(result.safety_flags.filter((f) => f.level === 'critical' && /discontinued/i.test(f.message))).toEqual([]);
    expect(result.data_sources_used).toContain('openfda_label');
    expect(result.data_sources_used).not.toContain('openfda_shortage');
  });
});

describe('runPharmacyLookup label identifiers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the label’s application number and set id, so FDA label links can be matched to the drug', async () => {
    stubNetwork();
    const result = await runPharmacyLookup('Max infusion rate for vancomycin?');

    expect(result.drug_lookups[0]).toMatchObject({
      generic_name: 'vancomycin',
      application_number: 'ANDA062911',
      set_id: '3b6b2a1e-0c4f-4f1e-9d4f-2d9c3f1a7b10',
    });
  });

  it('leaves them out when openFDA has no label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes('/api/ai/classify')
          ? json({ drug_names: ['notarealdrug'], query_domain: 'iv_drug_info', urgency: 'routine' })
          : json({ results: [] }),
      ),
    );
    const [drug] = (await runPharmacyLookup('Notarealdrug rate?')).drug_lookups;

    expect(drug.not_found).toBe(true);
    expect(drug.application_number).toBeUndefined();
    expect(drug.set_id).toBeUndefined();
  });
});

describe('formatLookupForPrompt', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never mentions shortage or discontinuation for a lookup result', async () => {
    stubNetwork();
    const result = await runPharmacyLookup('Max infusion rate for vancomycin?');
    const prompt = formatLookupForPrompt(result);

    expect(prompt).toContain('vancomycin');
    expect(prompt).toContain('FDA Label');
    expect(prompt).not.toMatch(/shortage|discontinued/i);
  });

  // A label excerpt plus a safety flag, as the Copilot sends it for a vancomycin question.
  const LOOKUP: LookupResult = {
    classification: { drug_names: ['vancomycin'], query_domain: 'iv_drug_info', urgency: 'routine' },
    drug_lookups: [
      {
        generic_name: 'vancomycin',
        label_sections: [
          {
            drug: 'vancomycin',
            field: 'dosage_and_administration',
            label: 'Dosage & Administration',
            content: 'Infuse over at least 60 minutes.',
            source: 'openFDA',
          },
        ],
      },
    ],
    safety_flags: [{ level: 'warning', category: 'vesicant', drug: 'vancomycin', message: 'Irritant.' }],
    data_sources_used: ['openfda_label'],
  };

  it('never tells the model to search less than its instructions ask', () => {
    const prompt = formatLookupForPrompt(LOOKUP);
    expect(prompt).not.toMatch(/ONLY for items not covered/i);
    expect(prompt).not.toMatch(/\bsearch\b[^.]*\bonly\b|\bonly\b[^.]*\bsearch\b/i);
    expect(prompt).toContain('Treat the above as authoritative for what it covers.');
    expect(prompt).toContain('Still search before answering, as instructed');
    // The search instruction is the last thing the model reads in its system prompt.
    expect(prompt.trimEnd().split('\n').pop()).toMatch(/Still search before answering/);
  });

  it('anchors the answer, not a brief, on the lookup and keeps its heading', () => {
    const prompt = formatLookupForPrompt(LOOKUP);
    expect(prompt.split('\n')[0]).toBe('## PRE-FETCHED AUTHORITATIVE DATA (verified — anchor your answer on this)');
    expect(prompt).not.toMatch(/\bbrief\b/i);
  });
});
