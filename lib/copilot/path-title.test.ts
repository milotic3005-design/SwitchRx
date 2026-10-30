import { describe, it, expect } from 'vitest';
import { pathTitle, titleWebSources } from './path-title';
import { classifySource, fallbackSource } from './source-types';
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
    expect(pathTitle('https://example.org/guides/dosing-100%25-bad%E0')).toBe('Guides › Dosing 100%25 bad%E0');
  });

  it('skips generic segments', () => {
    expect(pathTitle('https://example.org/en/us/heparin/index.html')).toBe('Heparin');
    expect(pathTitle('https://example.org/en-us/home/oncology/default.htm')).toBe('Oncology');
  });

  it('skips ID-like segments: numbers, long letter-and-digit tokens, hex ids and dates', () => {
    expect(pathTitle('https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/103772s5412lbl.pdf')).toBe(
      'Drugsatfda docs › Label (PDF)',
    );
    expect(pathTitle('https://example.org/reviews/PMC4558633/')).toBe('Reviews');
    expect(pathTitle('https://example.org/monographs/a0a046c1-056d-45a9-bfd9-13b47c24f257')).toBe('Monographs');
    expect(pathTitle('https://example.org/news/2024-10-29/rapid-infliximab')).toBe('News › Rapid infliximab');
    expect(pathTitle('https://example.org/news/123456/')).toBe('News');
  });

  it('skips publisher path words and DOI prefixes, so article links give no title of their own', () => {
    for (const url of [
      'https://www.nejm.org/doi/full/10.1056/NEJMoa2034577',
      'https://www.nejm.org/doi/abs/10.1056/NEJMoa2034577',
      'https://www.ncbi.nlm.nih.gov/books/NBK482405/',
      'https://www.sciencedirect.com/science/article/pii/S0002934319301234',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC4558633/',
      'https://onlinelibrary.wiley.com/doi/fulltext/10.1002/phar.2501',
      'https://example.org/abstract/10.1093/abc',
    ]) {
      expect(pathTitle(url), url).toBeNull();
    }
    expect(pathTitle('https://jamanetwork.com/journals/jama/fullarticle/2768391')).toBe('Jama');
    expect(pathTitle('https://academic.oup.com/cid/article/71/6/1400/5824444')).toBe('Cid');
  });

  it('keeps short or separated tokens that mix letters and digits', () => {
    expect(pathTitle('https://example.org/guidance/covid-19')).toBe('Guidance › Covid 19');
    expect(pathTitle('https://example.org/products/b12')).toBe('Products › B12');
  });

  it('skips a segment with at least five digits and no more letters than digits, such as an Elsevier article id', () => {
    expect(pathTitle('https://www.ajkd.org/article/S0272-6386(20)30123-4/fulltext')).toBeNull();
    expect(pathTitle('https://www.jacionline.org/article/S0091-6749(19)31234-5/fulltext')).toBeNull();
    expect(pathTitle('https://example.org/documents/doc-20240118-001')).toBe('Documents');
  });

  it('still titles a segment where a year sits among words', () => {
    expect(pathTitle('https://example.org/guidelines/2024-ashp-guidelines')).toBe('Guidelines › 2024 ashp guidelines');
    expect(pathTitle('https://example.org/news/fda-update-12345-infliximab-biosimilars')).toBe('News › Fda update 12345 infliximab biosimilars');
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

  it('keeps the domain title on journal, PubMed, PMC, book and other literature sources', () => {
    const literature = [
      'https://www.nejm.org/doi/full/10.1056/NEJMoa2034577',
      'https://www.ncbi.nlm.nih.gov/books/NBK482405/',
      'https://www.sciencedirect.com/science/article/pii/S0002934319301234',
      'https://jamanetwork.com/journals/jama/fullarticle/2768391',
      'https://academic.oup.com/cid/article/71/6/1400/5824444',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC4558633/',
      'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD012345/full',
    ].map(url => {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return resolved(host.split('.').slice(-2).join('.'), url, { type: classifySource({ host }) });
    });
    expect(literature.map(s => s.type)).toEqual(['journal', 'journal', 'journal', 'journal', 'journal', 'journal', 'systematic-review']);
    expect(titleWebSources(literature)).toEqual(literature);
    for (const type of ['trial', 'systematic-review', 'journal'] as const) {
      const source = resolved('example.org', 'https://example.org/vancomycin-dosing', { type });
      expect(titleWebSources([source])[0], type).toEqual(source);
    }
  });

  it('keeps the domain title for an article on a journal host it does not know, or on Europe PMC', () => {
    // Neither gets a path title: an Elsevier article id is not words, and Europe PMC is a literature host.
    const ajkd = resolved('ajkd.org', 'https://www.ajkd.org/article/S0272-6386(20)30123-4/fulltext');
    const europepmc = resolved('europepmc.org', 'https://europepmc.org/article/MED/32345678');
    expect(europepmc.type).toBe('journal');
    expect(titleWebSources([ajkd, europepmc])).toEqual([ajkd, europepmc]);
  });

  it('still titles guideline, agency, FDA and web pages', () => {
    for (const type of ['guideline', 'agency', 'fda-label', 'web'] as const) {
      const source = resolved('example.org', 'https://example.org/vancomycin-dosing', { type });
      expect(titleWebSources([source])[0].title, type).toBe('Vancomycin dosing');
    }
  });

  it('does not mutate its input', () => {
    const source = resolved('rxwiki.com', 'https://www.rxwiki.com/medications/remicade');
    const before = { ...source };
    titleWebSources([source]);
    expect(source).toEqual(before);
  });
});
