import { describe, expect, it } from 'vitest';
import { fallbackSource } from '@/lib/copilot/source-types';
import fixture from './__fixtures__/esummary-16914701.json';
import { enrichSources, MAX_CACHE_ENTRIES, type EnrichDeps } from './enrich';
import type { FetchLike } from './resolve-redirect';

const GROUNDING = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/';
const ESUMMARY = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const IDCONV = 'https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/';

const R1 = `${GROUNDING}pubmed-1`;
const PUBMED_URL = 'https://pubmed.ncbi.nlm.nih.gov/16914701/';
const IDSA_URL = 'https://www.idsociety.org/practice-guideline/x';

const DAY = 24 * 60 * 60 * 1000;

/** What a fake grounding URI does: 302 to a destination, 200 with no Location, or hang. */
type Redirect = string | null | 'hang' | 'hang-until-abort';

interface World {
  redirects?: Record<string, Redirect>;
  esummary?: (ids: string[]) => Response | Promise<Response>;
  idconv?: (ids: string[]) => Response | Promise<Response>;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** One esummary record for `id`; the real saved fixture for 16914701. */
const record = (id: string) =>
  id === '16914701'
    ? fixture.result['16914701']
    : {
        uid: id,
        title: `Title ${id}`,
        source: 'J Test',
        fulljournalname: 'The Journal of Testing',
        pubdate: '2020 Jan 5',
        authors: [{ name: 'Smith A', authtype: 'Author' }],
        pubtype: ['Journal Article'],
      };

const esummaryOk = (ids: string[]) =>
  json({ result: { uids: ids, ...Object.fromEntries(ids.map((id) => [id, record(id)])) } });

const idsIn = (url: string, param: string) =>
  (new URL(url).searchParams.get(param) ?? '').split(',').filter(Boolean);

/** Routes by URL, records every request, and answers anything unexpected with a 404. */
function fakeFetch(world: World) {
  const calls: string[] = [];
  const signals = new Map<string, AbortSignal | undefined>();
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push(input);
    signals.set(input, init?.signal ?? undefined);
    if (input.startsWith(GROUNDING)) {
      const dest = world.redirects?.[input];
      if (dest === 'hang') return new Promise<Response>(() => {});
      if (dest === 'hang-until-abort') {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      if (typeof dest === 'string') return new Response(null, { status: 302, headers: { Location: dest } });
      return new Response(null, { status: 200 });
    }
    if (input.startsWith(ESUMMARY)) return (world.esummary ?? esummaryOk)(idsIn(input, 'id'));
    if (input.startsWith(IDCONV) && world.idconv) return world.idconv(idsIn(input, 'ids'));
    return new Response('not found', { status: 404 });
  };
  return { fetchImpl, calls, signals };
}

/** The only outbound requests allowed: the grounding redirect lookup and NCBI API calls. */
function expectOnlyAllowedCalls(calls: string[]) {
  for (const url of calls) {
    expect(
      url.startsWith(GROUNDING) || url.startsWith(`${ESUMMARY}?`) || url.startsWith(`${IDCONV}?`),
      `unexpected request to ${url}`,
    ).toBe(true);
  }
}

const countCalls = (calls: string[], prefix: string) => calls.filter((c) => c.startsWith(prefix)).length;

type Cache = NonNullable<EnrichDeps['cache']>;

describe('enrichSources', () => {
  it('enriches a PubMed source end to end', async () => {
    const { fetchImpl, calls } = fakeFetch({ redirects: { [R1]: PUBMED_URL } });
    const [s] = await enrichSources(
      [{ uri: R1, title: 'pubmed.ncbi.nlm.nih.gov' }],
      { fetchImpl, cache: new Map() },
    );
    expect(s).toEqual({
      uri: R1,
      url: 'https://pubmed.ncbi.nlm.nih.gov/16914701/',
      site: 'pubmed.ncbi.nlm.nih.gov',
      title: 'Daptomycin versus standard therapy for bacteremia and endocarditis caused by Staphylococcus aureus.',
      shortName: 'N Engl J Med',
      journal: 'The New England journal of medicine',
      year: 2006,
      authors: 'Fowler VG Jr, Boucher HW, Corey GR, et al.',
      pmid: '16914701',
      type: 'trial',
    });
    expect(countCalls(calls, GROUNDING)).toBe(1);
    expect(calls.filter((c) => c.startsWith(ESUMMARY))).toEqual([
      `${ESUMMARY}?db=pubmed&retmode=json&tool=switchrx&id=16914701`,
    ]);
    expectOnlyAllowedCalls(calls);
  });

  it('types a society guideline without calling NCBI', async () => {
    const R = `${GROUNDING}idsa`;
    const { fetchImpl, calls } = fakeFetch({ redirects: { [R]: IDSA_URL } });
    const [s] = await enrichSources([{ uri: R, title: 'idsociety.org' }], { fetchImpl, cache: new Map() });
    expect(s).toEqual({
      uri: R,
      url: IDSA_URL,
      site: 'idsociety.org',
      title: 'idsociety.org',
      shortName: 'IDSA',
      type: 'guideline',
    });
    expect(calls).toEqual([R]);
  });

  it('falls back for disallowed URIs, unresolved redirects, and NCBI failure while enriching the rest', async () => {
    const evil = { uri: 'https://evil.example/a', title: 'cdc.gov' };
    const noLocation = { uri: `${GROUNDING}no-location`, title: 'example.com' };
    const pubmed = { uri: R1, title: 'Daptomycin trial' };
    const idsa = { uri: `${GROUNDING}idsa`, title: 'idsociety.org' };
    const { fetchImpl, calls } = fakeFetch({
      redirects: { [noLocation.uri]: null, [pubmed.uri]: PUBMED_URL, [idsa.uri]: IDSA_URL },
      esummary: () => new Response('Too Many Requests', { status: 429 }),
    });

    const out = await enrichSources([evil, noLocation, pubmed, idsa], { fetchImpl, cache: new Map() });

    expect(out).toHaveLength(4);
    expect(out[0]).toEqual(fallbackSource(evil));
    expect(out[0]).toMatchObject({ url: null, shortName: 'CDC', type: 'agency' });
    expect(out[1]).toEqual(fallbackSource(noLocation));
    // The PubMed source keeps what the redirect proved, but gets no NCBI metadata.
    expect(fallbackSource(pubmed)).toMatchObject({ site: 'web', type: 'web' });
    expect(out[2]).toEqual({
      ...fallbackSource(pubmed),
      url: PUBMED_URL,
      site: 'pubmed.ncbi.nlm.nih.gov',
      shortName: 'PubMed',
      type: 'journal',
    });
    expect(out[3]).toMatchObject({ url: IDSA_URL, shortName: 'IDSA', type: 'guideline' });
    expect(calls).not.toContain(evil.uri);
    expectOnlyAllowedCalls(calls);
  });

  it('batches PMIDs and PMC ids from all sources into one NCBI call each, looking up PMC ids in upper case', async () => {
    const pmc = `${GROUNDING}pmc`;
    const other = `${GROUNDING}other`;
    const idconvIds: string[][] = [];
    const { fetchImpl, calls } = fakeFetch({
      redirects: {
        [R1]: PUBMED_URL,
        // lower-case PMC id in the destination path
        [pmc]: 'https://pmc.ncbi.nlm.nih.gov/articles/pmc3036345/',
        [other]: 'https://www.ncbi.nlm.nih.gov/pubmed/21310000',
      },
      idconv: (ids) => {
        idconvIds.push(ids);
        return json({ records: [{ pmcid: 'PMC3036345', pmid: '31000001' }] });
      },
    });

    const out = await enrichSources(
      [
        { uri: R1, title: 'a' },
        { uri: pmc, title: 'b' },
        { uri: other, title: 'c' },
      ],
      { fetchImpl, cache: new Map() },
    );

    expect(out.map((s) => s.pmid)).toEqual(['16914701', '31000001', '21310000']);
    expect(out[1]).toMatchObject({
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/pmc3036345/',
      site: 'pmc.ncbi.nlm.nih.gov',
      title: 'Title 31000001',
      shortName: 'J Test',
      type: 'journal',
    });
    expect(idconvIds).toEqual([['PMC3036345']]);
    const esummaryCalls = calls.filter((c) => c.startsWith(ESUMMARY));
    expect(esummaryCalls).toHaveLength(1);
    expect(idsIn(esummaryCalls[0], 'id').sort()).toEqual(['16914701', '21310000', '31000001']);
    expectOnlyAllowedCalls(calls);
  });

  it('keeps the PMC link without metadata when the PMC id has no PMID', async () => {
    const pmc = `${GROUNDING}pmc`;
    const dest = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC999/';
    const { fetchImpl, calls } = fakeFetch({
      redirects: { [pmc]: dest },
      idconv: () => json({ records: [{ pmcid: 'PMC999', status: 'error' }] }),
    });
    const src = { uri: pmc, title: 'A PMC article' };
    const [s] = await enrichSources([src], { fetchImpl, cache: new Map() });
    expect(s).toEqual({
      ...fallbackSource(src),
      url: dest,
      site: 'pmc.ncbi.nlm.nih.gov',
      shortName: 'PubMed',
      type: 'journal',
    });
    expect(countCalls(calls, ESUMMARY)).toBe(0);
  });

  it('resolves at most 6 links at a time', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl: FetchLike = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return new Response(null, { status: 302, headers: { Location: IDSA_URL } });
    };
    const sources = Array.from({ length: 15 }, (_, i) => ({ uri: `${GROUNDING}c${i}`, title: 'idsociety.org' }));
    const out = await enrichSources(sources, { fetchImpl, cache: new Map() });
    expect(out.every((s) => s.url === IDSA_URL)).toBe(true);
    expect(maxInFlight).toBe(6);
  });

  it('preserves input order and length', async () => {
    const a = `${GROUNDING}a`;
    const c = `${GROUNDING}c`;
    const { fetchImpl } = fakeFetch({ redirects: { [a]: IDSA_URL, [R1]: PUBMED_URL, [c]: null } });
    const inputs = [
      { uri: a, title: 'idsociety.org' },
      { uri: 'https://evil.example/b', title: 'b' },
      { uri: R1, title: 'pubmed.ncbi.nlm.nih.gov' },
      { uri: c, title: 'c' },
    ];
    const out = await enrichSources(inputs, { fetchImpl, cache: new Map() });
    expect(out.map((s) => s.uri)).toEqual(inputs.map((i) => i.uri));
    expect(await enrichSources([], { fetchImpl, cache: new Map() })).toEqual([]);
  });

  describe('time budget', () => {
    it('returns fallbacks for sources unfinished when the overall budget elapses', async () => {
      const hung = { uri: `${GROUNDING}hung`, title: 'example.com' };
      const idsa = { uri: `${GROUNDING}idsa`, title: 'idsociety.org' };
      // The hanging fetch ignores its AbortSignal, so only the budget race can end the wait.
      const { fetchImpl, signals } = fakeFetch({ redirects: { [hung.uri]: 'hang', [idsa.uri]: IDSA_URL } });

      const started = Date.now();
      const out = await enrichSources([hung, idsa], { fetchImpl, cache: new Map() }, { totalTimeoutMs: 30 });

      expect(Date.now() - started).toBeLessThan(1000);
      expect(out[0]).toEqual(fallbackSource(hung));
      // Work that finished within the budget is kept.
      expect(out[1]).toMatchObject({ url: IDSA_URL, type: 'guideline' });
      // In-flight work was told to stop.
      expect(signals.get(hung.uri)?.aborted).toBe(true);
    });

    it('returns the fallback for a PubMed source whose NCBI lookup is unfinished at the deadline', async () => {
      const src = { uri: R1, title: 'Daptomycin trial' };
      const { fetchImpl, signals } = fakeFetch({
        redirects: { [R1]: PUBMED_URL },
        esummary: () => new Promise<Response>(() => {}),
      });
      const out = await enrichSources([src], { fetchImpl, cache: new Map() }, { totalTimeoutMs: 30 });
      expect(out).toEqual([fallbackSource(src)]);
      const esummaryUrl = [...signals.keys()].find((u) => u.startsWith(ESUMMARY));
      expect(signals.get(esummaryUrl ?? '')?.aborted).toBe(true);
    });

    it('gives up on a single slow link after perLinkTimeoutMs without spending the whole budget', async () => {
      const slow = { uri: `${GROUNDING}slow`, title: 'example.com' };
      const idsa = { uri: `${GROUNDING}idsa`, title: 'idsociety.org' };
      const { fetchImpl } = fakeFetch({ redirects: { [slow.uri]: 'hang-until-abort', [idsa.uri]: IDSA_URL } });

      const started = Date.now();
      const out = await enrichSources(
        [slow, idsa],
        { fetchImpl, cache: new Map() },
        { perLinkTimeoutMs: 20, totalTimeoutMs: 5000 },
      );

      expect(Date.now() - started).toBeLessThan(1000);
      expect(out[0]).toEqual(fallbackSource(slow));
      expect(out[1]).toMatchObject({ url: IDSA_URL });
    });

    it('does not let work that finishes after the deadline change the returned array', async () => {
      const src = { uri: R1, title: 'idsociety.org' };
      let release: (r: Response) => void = () => {};
      const fetchImpl: FetchLike = () => new Promise<Response>((r) => { release = r; });
      const out = await enrichSources([src], { fetchImpl, cache: new Map() }, { totalTimeoutMs: 20 });
      release(new Response(null, { status: 302, headers: { Location: IDSA_URL } }));
      await new Promise((r) => setTimeout(r, 20));
      expect(out).toEqual([fallbackSource(src)]);
    });

    it('returns fallbacks instead of throwing if a dependency misbehaves', async () => {
      const src = { uri: R1, title: 'idsociety.org' };
      const { fetchImpl } = fakeFetch({ redirects: { [R1]: IDSA_URL } });
      const now = () => {
        throw new Error('clock broke');
      };
      await expect(enrichSources([src], { fetchImpl, cache: new Map(), now })).resolves.toEqual([
        fallbackSource(src),
      ]);
    });
  });

  describe('cache', () => {
    it('serves repeat URIs from the cache', async () => {
      const { fetchImpl, calls } = fakeFetch({ redirects: { [R1]: PUBMED_URL } });
      const cache: Cache = new Map();
      const src = { uri: R1, title: 'pubmed.ncbi.nlm.nih.gov' };

      const first = await enrichSources([src], { fetchImpl, cache });
      const callsAfterFirst = calls.length;
      expect(callsAfterFirst).toBe(2);

      const second = await enrichSources([src], { fetchImpl, cache });
      expect(calls.length).toBe(callsAfterFirst);
      expect(second).toEqual(first);
    });

    it('expires entries after 24 hours, using the injected clock', async () => {
      const { fetchImpl, calls } = fakeFetch({ redirects: { [R1]: IDSA_URL } });
      const cache: Cache = new Map();
      const src = { uri: R1, title: 'idsociety.org' };
      let t = 1_000_000;
      const deps = { fetchImpl, cache, now: () => t };

      await enrichSources([src], deps);
      expect(calls).toHaveLength(1);

      t += DAY - 1;
      await enrichSources([src], deps);
      expect(calls).toHaveLength(1);

      t += 2;
      await enrichSources([src], deps);
      expect(calls).toHaveLength(2);
    });

    it('does not cache fallbacks, so a later request can succeed', async () => {
      const cache: Cache = new Map();
      const src = { uri: R1, title: 'Daptomycin trial' };

      // Unresolved redirect.
      const down = fakeFetch({ redirects: { [R1]: null } });
      await enrichSources([src], { fetchImpl: down.fetchImpl, cache });
      // Timeout.
      const hung = fakeFetch({ redirects: { [R1]: 'hang' } });
      await enrichSources([src], { fetchImpl: hung.fetchImpl, cache }, { totalTimeoutMs: 20 });
      // NCBI failure keeps the link but is not a complete enrichment either.
      const ncbiDown = fakeFetch({
        redirects: { [R1]: PUBMED_URL },
        esummary: () => new Response('Too Many Requests', { status: 429 }),
      });
      await enrichSources([src], { fetchImpl: ncbiDown.fetchImpl, cache });
      expect(cache.size).toBe(0);

      const healthy = fakeFetch({ redirects: { [R1]: PUBMED_URL } });
      const [s] = await enrichSources([src], { fetchImpl: healthy.fetchImpl, cache });
      expect(s).toMatchObject({ pmid: '16914701', shortName: 'N Engl J Med', type: 'trial' });
      expect(cache.size).toBe(1);
    });

    it('does not cache disallowed URIs', async () => {
      const { fetchImpl } = fakeFetch({});
      const cache: Cache = new Map();
      await enrichSources([{ uri: 'https://evil.example/a', title: 'cdc.gov' }], { fetchImpl, cache });
      expect(cache.size).toBe(0);
    });

    it('hands out copies, so callers cannot corrupt the cache', async () => {
      const { fetchImpl } = fakeFetch({ redirects: { [R1]: IDSA_URL } });
      const cache: Cache = new Map();
      const src = { uri: R1, title: 'idsociety.org' };

      const [first] = await enrichSources([src], { fetchImpl, cache });
      first.title = 'tampered';
      const [second] = await enrichSources([src], { fetchImpl, cache });
      expect(second.title).toBe('idsociety.org');
      second.title = 'tampered again';
      const [third] = await enrichSources([src], { fetchImpl, cache });
      expect(third.title).toBe('idsociety.org');
    });

    it('stays within its size cap, dropping the oldest entries first', async () => {
      const dest = new Map<string, string>();
      const sources = Array.from({ length: MAX_CACHE_ENTRIES + 20 }, (_, i) => {
        const uri = `${GROUNDING}n${i}`;
        dest.set(uri, IDSA_URL);
        return { uri, title: 'idsociety.org' };
      });
      const fetchImpl: FetchLike = async (input) =>
        new Response(null, { status: 302, headers: { Location: dest.get(input) ?? IDSA_URL } });
      const cache: Cache = new Map();

      await enrichSources(sources, { fetchImpl, cache });

      expect(cache.size).toBe(MAX_CACHE_ENTRIES);
      expect(cache.has(sources[sources.length - 1].uri)).toBe(true);
      expect(cache.has(sources[0].uri)).toBe(false);
    });
  });
});
