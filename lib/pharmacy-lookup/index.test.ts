import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatLookupForPrompt, runPharmacyLookup } from './index';

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
              openfda: { manufacturer_name: ['Example Pharma'], rxcui: ['11124'] },
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
});
