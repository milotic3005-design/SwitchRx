import { describe, it, expect } from 'vitest';
import { classifySource, fallbackSource, isDomainTitle, isRecent, siteName, siteShortName, sourceMix, TYPE_LABEL } from './source-types';
import type { SourceType } from './types';

const V = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc';

describe('classifySource', () => {
  it.each([
    [{ host: 'dailymed.nlm.nih.gov' }, 'fda-label'],
    [{ host: 'www.accessdata.fda.gov' }, 'fda-label'],
    [{ host: 'pubmed.ncbi.nlm.nih.gov', pubtypes: ['Journal Article', 'Randomized Controlled Trial'] }, 'trial'],
    [{ host: 'pubmed.ncbi.nlm.nih.gov', pubtypes: ['Practice Guideline'] }, 'guideline'],
    [{ host: 'pubmed.ncbi.nlm.nih.gov', pubtypes: ['Meta-Analysis'] }, 'systematic-review'],
    [{ host: 'www.idsociety.org' }, 'guideline'],
    [{ host: 'www.cochranelibrary.com' }, 'systematic-review'],
    [{ host: 'pubmed.ncbi.nlm.nih.gov' }, 'journal'],
    [{ host: 'pmc.ncbi.nlm.nih.gov' }, 'journal'],
    [{ host: 'www.nejm.org' }, 'journal'],
    [{ host: 'europepmc.org' }, 'journal'],
    [{ host: 'www.cdc.gov' }, 'agency'],
    [{ host: 'example.com' }, 'web'],
  ])('classifySource(%o) → %s', (input, type) => expect(classifySource(input)).toBe(type));

  it('matches hosts by exact name or subdomain, never by substring', () => {
    expect(classifySource({ host: 'fda.gov' })).toBe('fda-label');
    expect(classifySource({ host: 'notfda.gov' })).toBe('web');
    expect(classifySource({ host: 'fda.gov.example.com' })).toBe('web');
  });
  it('checks the FDA host rule before pubtypes', () => {
    expect(classifySource({ host: 'dailymed.nlm.nih.gov', pubtypes: ['Practice Guideline'] })).toBe('fda-label');
  });
  it('checks guideline before systematic review before trial', () => {
    expect(classifySource({ host: 'x.org', pubtypes: ['Meta-Analysis', 'Guideline'] })).toBe('guideline');
    expect(classifySource({ host: 'x.org', pubtypes: ['Randomized Controlled Trial', 'Systematic Review'] })).toBe('systematic-review');
  });
  it('treats a society host as a guideline even when pubtypes say journal article', () => {
    expect(classifySource({ host: 'www.ashp.org', pubtypes: ['Journal Article'] })).toBe('guideline');
  });
  it('treats any "Clinical Trial…" pubtype as a trial', () => {
    expect(classifySource({ host: 'pubmed.ncbi.nlm.nih.gov', pubtypes: ['Clinical Trial, Phase III'] })).toBe('trial');
  });
  it('treats any pubtypes on an unlisted host as a journal article', () => {
    expect(classifySource({ host: 'example.com', pubtypes: ['Journal Article'] })).toBe('journal');
    expect(classifySource({ host: 'example.com', pubtypes: [] })).toBe('web');
  });
  it('checks journal hosts before the nih.gov agency host', () => {
    expect(classifySource({ host: 'www.nih.gov' })).toBe('agency');
    expect(classifySource({ host: 'ncbi.nlm.nih.gov' })).toBe('journal');
  });
});

describe('siteShortName', () => {
  it.each([
    ['dailymed.nlm.nih.gov', 'FDA label'],
    ['www.accessdata.fda.gov', 'FDA label'],
    ['www.idsociety.org', 'IDSA'],
    ['ashp.org', 'ASHP'],
    ['www.nccn.org', 'NCCN'],
    ['www.ins1.org', 'INS'],
    ['www.ons.org', 'ONS'],
    ['www.asco.org', 'ASCO'],
    ['www.hematology.org', 'ASH'],
    ['www.rheumatology.org', 'ACR'],
    ['www.cochranelibrary.com', 'Cochrane'],
    ['pubmed.ncbi.nlm.nih.gov', 'PubMed'],
    ['pmc.ncbi.nlm.nih.gov', 'PubMed'],
    ['www.cdc.gov', 'CDC'],
    ['www.nih.gov', 'NIH'],
    ['www.who.int', 'WHO'],
    ['www.cms.gov', 'CMS'],
    ['', 'Web'],
    ['www.example.com', 'example.com'],
    ['journals.example.org', 'journals.example.org'],
  ])('siteShortName(%j) → %s', (host, name) => expect(siteShortName(host)).toBe(name));
});

describe('fallbackSource', () => {
  it('builds a fallback from a domain-style grounding title', () => {
    expect(fallbackSource({ uri: V, title: 'idsociety.org' })).toEqual({
      uri: V, url: null, site: 'idsociety.org', title: 'idsociety.org', shortName: 'IDSA', type: 'guideline',
    });
  });
  it('builds a web fallback when the title is not a domain', () => {
    expect(fallbackSource({ uri: V, title: 'Some page title' })).toMatchObject({ site: 'web', shortName: 'Web', type: 'web', url: null });
  });
  it('lowercases a domain title and strips www. for the site', () => {
    expect(fallbackSource({ uri: V, title: ' WWW.CDC.gov ' })).toMatchObject({ site: 'cdc.gov', shortName: 'CDC', type: 'agency' });
  });
  it('falls back to the uri host when the title is not a domain and the uri is not the Vertex redirect', () => {
    expect(fallbackSource({ uri: 'https://www.nejm.org/doi/full/10.1056/x', title: 'A trial of something' }))
      .toMatchObject({ site: 'nejm.org', shortName: 'nejm.org', type: 'journal' });
  });
  it('treats an unparseable uri as having no host', () => {
    expect(fallbackSource({ uri: 'not a url', title: 'Some page title' })).toMatchObject({ site: 'web', type: 'web' });
  });
});

describe('isDomainTitle', () => {
  it('is true only for a bare domain', () => {
    expect(isDomainTitle('pfizermedical.com')).toBe(true);
    expect(isDomainTitle(' wa-provider.kaiserpermanente.org ')).toBe(true);
    expect(isDomainTitle('DailyMed - REMICADE')).toBe(false);
    expect(isDomainTitle('Dosing & Administration | REMICADE® (infliximab) HCP')).toBe(false);
    expect(isDomainTitle('')).toBe(false);
  });
});

describe('siteName', () => {
  const web = { ...fallbackSource({ uri: V, title: 'kaiserpermanente.org' }), site: 'wa-provider.kaiserpermanente.org', shortName: 'wa-provider.kaiserpermanente.org' };

  it('names the site the way its citation chip does', () => {
    expect(siteName(web)).toBe('wa-provider.kaiserpermanente.org');
    expect(siteName({ ...web, site: 'idsociety.org', shortName: 'IDSA', type: 'guideline' })).toBe('IDSA');
  });
  it('prefers the full journal name', () => {
    expect(siteName({ ...web, shortName: 'J Crohns Colitis', journal: "Journal of Crohn's & colitis" })).toBe("Journal of Crohn's & colitis");
  });
  it('names the site when the short name only repeats the type tag', () => {
    expect(siteName({ ...web, site: 'accessdata.fda.gov', shortName: 'FDA label', type: 'fda-label' })).toBe('accessdata.fda.gov');
  });
});

describe('sourceMix', () => {
  const s = (type: SourceType) => ({ ...fallbackSource({ uri: V, title: 'x.org' }), type });

  it('summarizes cited sources in tier order', () => {
    const mix = sourceMix([s('trial'), s('guideline'), s('fda-label'), s('guideline')]);
    expect(mix.text).toBe('1 FDA label · 2 guidelines · 1 trial');
    expect(mix.groups.map(g => [g.type, g.sourceIndices])).toEqual([['fda-label', [2]], ['guideline', [1, 3]], ['trial', [0]]]);
  });
  it('shows only the first three groups in the text', () => {
    const mix = sourceMix([s('web'), s('journal'), s('trial'), s('guideline')]);
    expect(mix.text).toBe('1 guideline · 1 trial · 1 article');
    expect(mix.groups).toHaveLength(4);
  });
  it('returns an empty mix for no sources', () => expect(sourceMix([])).toEqual({ groups: [], text: '' }));
  it('uses singular and plural labels for every type', () => {
    const all: SourceType[] = ['fda-label', 'guideline', 'systematic-review', 'trial', 'journal', 'agency', 'web'];
    const one = sourceMix(all.map(s));
    expect(one.groups.map(g => g.label)).toEqual([
      '1 FDA label', '1 guideline', '1 systematic review', '1 trial', '1 article', '1 agency source', '1 web source',
    ]);
    const two = sourceMix(all.flatMap(t => [s(t), s(t)]));
    expect(two.groups.map(g => g.label)).toEqual([
      '2 FDA labels', '2 guidelines', '2 systematic reviews', '2 trials', '2 articles', '2 agency sources', '2 web sources',
    ]);
    expect(two.groups.map(g => g.count)).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });
});

describe('isRecent', () => {
  it('marks sources from the last two years as recent', () => {
    const now = new Date('2026-10-28');
    expect([2026, 2024, 2023, undefined].map(y => isRecent(y, now))).toEqual([true, true, false, false]);
  });
});

describe('TYPE_LABEL', () => {
  it('labels every source type', () => {
    expect(TYPE_LABEL).toEqual({
      'fda-label': 'FDA label',
      guideline: 'Guideline',
      'systematic-review': 'Systematic review',
      trial: 'Trial',
      journal: 'Journal',
      agency: 'Agency',
      web: 'Web',
    });
  });
});
