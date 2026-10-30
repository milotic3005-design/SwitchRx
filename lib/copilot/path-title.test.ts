import { describe, it, expect } from 'vitest';
import { pathTitle, titleWebSources } from './path-title';
import { fallbackSource } from './source-types';
import type { EnrichedSource } from './types';

const V = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc';

/** A resolved source whose grounding title is the bare domain `title`, as Gemini usually sends. */
const resolved = (title: string, url: string | null, extra: Partial<EnrichedSource> = {}): EnrichedSource => {
  const host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
  return { ...fallbackSource({ uri: V, title }), url, ...(host ? { site: host, shortName: host } : {}), ...extra };
};

describe('pathTitle', () => {
  it.each([
    ['https://www.pfizermedical.com/inflectra/dosage-admin', 'Inflectra › Dosage admin'],
    ['https://www.rxwiki.com/medications/remicade', 'Medications › Remicade'],
    [
      'https://wa-provider.kaiserpermanente.org/static/pdf/hosting/clinical/criteria/pdf/provider-support/infliximab-1.pdf',
      'Provider support › Infliximab 1 (PDF)',
    ],
    ['https://www.remicadehcp.com/crohns-disease/dosing-administration.html', 'Crohns disease › Dosing administration'],
    ['https://www.niddk.nih.gov/health-information/digestive-diseases/crohns-disease/treatment', 'Crohns disease › Treatment'],
  ])('%s → %s', (url, title) => expect(pathTitle(url)).toBe(title));

  it('uses one segment when that is all there is', () => {
    expect(pathTitle('https://example.org/vancomycin-dosing/')).toBe('Vancomycin dosing');
  });

  it('returns null when the path has nothing usable', () => {
    for (const url of [
      'https://example.org/',
      'https://example.org',
      'https://example.org/index.html',
      'https://example.org/en/us/default.aspx',
      'https://example.org/?q=infliximab',
      'not a url',
    ]) {
      expect(pathTitle(url), url).toBeNull();
    }
  });

  it('URL-decodes segments and turns dashes and underscores into spaces', () => {
    expect(pathTitle('https://example.org/drug%20info/iron_sucrose--dosing')).toBe('Drug info › Iron sucrose dosing');
  });

  it('keeps a segment that does not decode as it is', () => {
    expect(pathTitle('https://example.org/guides/100%25-bad%E0')).toBe('Guides › 100%25 bad%E0');
  });

  it('skips generic segments', () => {
    expect(pathTitle('https://example.org/en/us/heparin/index.html')).toBe('Heparin');
    expect(pathTitle('https://example.org/en-us/home/oncology/default.htm')).toBe('Oncology');
  });

  it('skips ID-like segments: numbers, long letter-and-digit tokens, hex ids and dates', () => {
    expect(pathTitle('https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/103772s5412lbl.pdf')).toBe(
      'Drugsatfda docs › Label (PDF)',
    );
    expect(pathTitle('https://example.org/articles/PMC4558633/')).toBe('Articles');
    expect(pathTitle('https://example.org/monographs/a0a046c1-056d-45a9-bfd9-13b47c24f257')).toBe('Monographs');
    expect(pathTitle('https://example.org/news/2024-10-29/rapid-infliximab')).toBe('News › Rapid infliximab');
    expect(pathTitle('https://example.org/news/123456/')).toBe('News');
  });

  it('keeps short or separated tokens that mix letters and digits', () => {
    expect(pathTitle('https://example.org/guidance/covid-19')).toBe('Guidance › Covid 19');
    expect(pathTitle('https://example.org/products/b12')).toBe('Products › B12');
  });

  it('drops a file extension but marks a PDF', () => {
    expect(pathTitle('https://example.org/guides/heparin-protocol.PDF')).toBe('Guides › Heparin protocol (PDF)');
    expect(pathTitle('https://example.org/guides/heparin-protocol.aspx')).toBe('Guides › Heparin protocol');
  });

  it('capitalizes only the first letter of each part', () => {
    expect(pathTitle('https://example.org/dailymed/drugInfo.cfm')).toBe('Dailymed › DrugInfo');
  });
});

describe('titleWebSources', () => {
  it('titles a bare-domain source from its resolved URL', () => {
    const [a, b] = titleWebSources([
      resolved('pfizermedical.com', 'https://www.pfizermedical.com/inflectra/dosage-admin'),
      resolved('pfizermedical.com', 'https://www.pfizermedical.com/inflectra/patient/dosing'),
    ]);
    expect(a.title).toBe('Inflectra › Dosage admin');
    expect(b.title).toBe('Patient › Dosing');
  });

  it('keeps a bare domain title when the path has nothing usable', () => {
    const source = resolved('example.org', 'https://example.org/');
    expect(titleWebSources([source])).toEqual([source]);
  });

  it('names the resolved host instead of a different grounding domain when the path has nothing usable', () => {
    const [source] = titleWebSources([resolved('kaiserpermanente.org', 'https://wa-provider.kaiserpermanente.org/')]);
    expect(source.title).toBe('wa-provider.kaiserpermanente.org');
    expect(source.title).toBe(source.shortName);
  });

  it('leaves unresolved sources, real titles and PubMed records alone', () => {
    const unresolved = resolved('pfizermedical.com', null);
    const titled = resolved('Remicade (Infliximab) prescribing information', 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/103772s5412lbl.pdf');
    const pubmed = resolved('pubmed.ncbi.nlm.nih.gov', 'https://pubmed.ncbi.nlm.nih.gov/articles/12047962/', { pmid: '12047962' });
    expect(titleWebSources([unresolved, titled, pubmed])).toEqual([unresolved, titled, pubmed]);
  });

  it('does not mutate its input', () => {
    const source = resolved('rxwiki.com', 'https://www.rxwiki.com/medications/remicade');
    const before = { ...source };
    titleWebSources([source]);
    expect(source).toEqual(before);
  });
});
