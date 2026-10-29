import { describe, expect, it, vi } from 'vitest';
import fixture from './__fixtures__/esummary-16914701.json';
import { fetchPubmedSummaries, parseArticleId, pmcToPmid } from './ncbi';
import type { FetchLike } from './resolve-redirect';

const ESUMMARY_BASE =
  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&tool=switchrx&id=';
const IDCONV_BASE =
  'https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?format=json&tool=switchrx&ids=';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A minimal esummary record; override fields per test. */
const record = (uid: string, over: Record<string, unknown> = {}) => ({
  uid,
  title: `Title ${uid}`,
  source: 'J Test',
  fulljournalname: 'The Journal of Testing',
  pubdate: '2020 Jan 5',
  authors: [{ name: 'Smith A', authtype: 'Author' }],
  pubtype: ['Journal Article'],
  ...over,
});

const esummary = (...records: Array<{ uid: string }>) => ({
  result: {
    uids: records.map((r) => r.uid),
    ...Object.fromEntries(records.map((r) => [r.uid, r])),
  },
});

describe('parseArticleId', () => {
  it.each([
    ['https://pubmed.ncbi.nlm.nih.gov/16914701/', { pmid: '16914701' }],
    ['https://www.ncbi.nlm.nih.gov/pubmed/16914701', { pmid: '16914701' }],
    ['https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3036345/', { pmcid: 'PMC3036345' }],
    ['https://pmc.ncbi.nlm.nih.gov/articles/PMC3036345/', { pmcid: 'PMC3036345' }],
    ['https://www.nejm.org/doi/full/10.1056/NEJMoa053783', {}],
  ])('parseArticleId(%s)', (u, out) => expect(parseArticleId(u)).toEqual(out));

  it.each([
    // http, no trailing slash, query string
    ['http://pubmed.ncbi.nlm.nih.gov/16914701', { pmid: '16914701' }],
    ['https://pubmed.ncbi.nlm.nih.gov/16914701/?from_term=daptomycin', { pmid: '16914701' }],
    // the PMC id is normalised to upper case
    ['https://pmc.ncbi.nlm.nih.gov/articles/pmc3036345/', { pmcid: 'PMC3036345' }],
    // subpaths of a PMC article still identify that article
    ['https://pmc.ncbi.nlm.nih.gov/articles/PMC3036345/pdf/nihms-1.pdf', { pmcid: 'PMC3036345' }],
    ['https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3036345', { pmcid: 'PMC3036345' }],
  ])('accepts the variant %s', (u, out) => expect(parseArticleId(u)).toEqual(out));

  it.each([
    // search / landing pages carry no article id
    ['https://pubmed.ncbi.nlm.nih.gov/?term=daptomycin'],
    ['https://pubmed.ncbi.nlm.nih.gov/'],
    ['https://www.ncbi.nlm.nih.gov/pubmed/?term=16914701'],
    ['https://pmc.ncbi.nlm.nih.gov/articles/PMCabc/'],
    ['https://pmc.ncbi.nlm.nih.gov/articles/PMC/'],
    // an id-shaped path on a host that is not NCBI
    ['https://evil.example/pubmed/16914701'],
    ['https://evil.example/pmc/articles/PMC3036345/'],
    // lookalike and userinfo hosts
    ['https://pubmed.ncbi.nlm.nih.gov.evil.com/16914701/'],
    ['https://evilncbi.nlm.nih.gov/pubmed/16914701'],
    ['https://pubmed.ncbi.nlm.nih.gov@evil.com/16914701/'],
    // not http(s), not a URL
    ['ftp://pubmed.ncbi.nlm.nih.gov/16914701/'],
    ['javascript:alert(1)'],
    ['not a url'],
    [''],
  ])('returns {} for %s', (u) => expect(parseArticleId(u)).toEqual({}));

  it('returns {} for a non-string input rather than throwing', () => {
    expect(parseArticleId(undefined as unknown as string)).toEqual({});
  });
});

describe('fetchPubmedSummaries', () => {
  it('parses a saved esummary response', async () => {
    const f = vi.fn<FetchLike>(async () => new Response(JSON.stringify(fixture)));
    const m = await fetchPubmedSummaries(['16914701'], f);
    expect(m.get('16914701')).toEqual({
      title:
        'Daptomycin versus standard therapy for bacteremia and endocarditis caused by Staphylococcus aureus.',
      journalAbbrev: 'N Engl J Med',
      journal: 'The New England journal of medicine',
      year: 2006,
      authors: 'Fowler VG Jr, Boucher HW, Corey GR, et al.',
      pubtypes: expect.arrayContaining(['Randomized Controlled Trial']),
    });
    expect(f.mock.calls[0][0]).toContain('db=pubmed');
    expect(f.mock.calls[0][0]).toContain('tool=switchrx');
    expect(f.mock.calls[0][0]).toBe(`${ESUMMARY_BASE}16914701`);
  });

  it('batches several ids into one request', async () => {
    const f = vi.fn<FetchLike>(async () => json(esummary(record('1'), record('2'))));
    const m = await fetchPubmedSummaries(['1', '2'], f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(`${ESUMMARY_BASE}1,2`);
    expect(f.mock.calls[0][0]).toContain('id=1,2');
    expect([...m.keys()]).toEqual(['1', '2']);
    expect(m.get('1')?.title).toBe('Title 1');
    expect(m.get('2')?.title).toBe('Title 2');
  });

  it('sends a repeated id once', async () => {
    const f = vi.fn<FetchLike>(async () => json(esummary(record('7'))));
    await fetchPubmedSummaries(['7', '7'], f);
    expect(f.mock.calls[0][0]).toBe(`${ESUMMARY_BASE}7`);
  });

  it('passes the abort signal to fetch', async () => {
    const f = vi.fn<FetchLike>(async () => json(esummary(record('1'))));
    const controller = new AbortController();
    await fetchPubmedSummaries(['1'], f, controller.signal);
    expect(f.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  describe('never throws, returning an empty map', () => {
    it('on HTTP 429', async () => {
      const f = vi.fn<FetchLike>(async () => new Response('Too Many Requests', { status: 429 }));
      const m = await fetchPubmedSummaries(['1'], f);
      expect(m).toEqual(new Map());
      expect(f).toHaveBeenCalledTimes(1);
    });

    it('on a JSON error body served with HTTP 429', async () => {
      const f = vi.fn<FetchLike>(async () => json({ error: 'API rate limit exceeded' }, 429));
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it('on HTTP 500', async () => {
      const f = vi.fn<FetchLike>(async () => json(esummary(record('1')), 500));
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it('on a network error', async () => {
      const f = vi.fn<FetchLike>(async () => {
        throw new TypeError('fetch failed');
      });
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it('when fetch throws synchronously', async () => {
      const f: FetchLike = () => {
        throw new Error('boom');
      };
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it('when the request is aborted', async () => {
      const controller = new AbortController();
      const f = vi.fn<FetchLike>(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError')),
            );
          }),
      );
      const pending = fetchPubmedSummaries(['1'], f, controller.signal);
      controller.abort();
      expect(await pending).toEqual(new Map());
    });

    it('on a malformed JSON body', async () => {
      const f = vi.fn<FetchLike>(async () => new Response('<html>not json</html>'));
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it.each([
      ['null', null],
      ['an array', []],
      ['a string', 'result'],
      ['an empty object', {}],
      ['a null result', { result: null }],
      ['a string result', { result: 'nope' }],
      ['an array result', { result: [] }],
      ['a top-level error', { error: 'Invalid uid' }],
    ])('on an unexpected response shape (%s)', async (_label, body) => {
      const f = vi.fn<FetchLike>(async () => json(body));
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });
  });

  it('makes no request for an empty id list', async () => {
    const f = vi.fn<FetchLike>(async () => json(esummary(record('1'))));
    expect(await fetchPubmedSummaries([], f)).toEqual(new Map());
    expect(f).not.toHaveBeenCalled();
  });

  describe('id validation', () => {
    it('only sends ids made of digits', async () => {
      const f = vi.fn<FetchLike>(async () => json(esummary(record('16914701'))));
      await fetchPubmedSummaries(
        [
          '16914701',
          '1,2',
          'abc',
          '12abc',
          '../etc/passwd',
          '1&db=nuccore',
          '12 3',
          ' 5',
          '-4',
          '1.5',
          '',
          42 as unknown as string,
          null as unknown as string,
        ],
        f,
      );
      expect(f).toHaveBeenCalledTimes(1);
      expect(f.mock.calls[0][0]).toBe(`${ESUMMARY_BASE}16914701`);
    });

    it('makes no request when no id is valid', async () => {
      const f = vi.fn<FetchLike>(async () => json(esummary(record('1'))));
      expect(await fetchPubmedSummaries(['abc', '1,2', '', '1\n2'], f)).toEqual(new Map());
      expect(f).not.toHaveBeenCalled();
    });
  });

  describe('record handling', () => {
    it('skips uids with an error or no record', async () => {
      const f = vi.fn<FetchLike>(async () =>
        json({ result: { uids: ['1'], '1': { error: 'cannot get document summary' } } }),
      );
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it('keeps the good records when others in the batch are bad', async () => {
      const f = vi.fn<FetchLike>(async () =>
        json({
          result: {
            uids: ['1', '2', '3'],
            '1': record('1'),
            '2': { uid: '2', error: 'cannot get document summary' },
            // id 4 was requested but is absent from the response
            '3': record('3'),
          },
        }),
      );
      const m = await fetchPubmedSummaries(['1', '2', '3', '4'], f);
      expect([...m.keys()]).toEqual(['1', '3']);
    });

    it.each([
      ['a missing title', { title: undefined }],
      ['an empty title', { title: '' }],
      ['a non-string title', { title: 12 }],
    ])('skips a record with %s', async (_label, over) => {
      const f = vi.fn<FetchLike>(async () => json(esummary(record('1', over))));
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it('skips a record that is not an object', async () => {
      const f = vi.fn<FetchLike>(async () => json({ result: { uids: ['1'], '1': 'oops' } }));
      expect(await fetchPubmedSummaries(['1'], f)).toEqual(new Map());
    });

    it('takes the year from the first four digits of pubdate', async () => {
      const f = vi.fn<FetchLike>(async () =>
        json(esummary(record('1', { pubdate: '2019 Jul-Aug' }), record('2', { pubdate: '1999' }))),
      );
      const m = await fetchPubmedSummaries(['1', '2'], f);
      expect(m.get('1')?.year).toBe(2019);
      expect(m.get('2')?.year).toBe(1999);
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['not year-first', 'Spring'],
      ['not a string', 2020],
    ])('omits the year when pubdate is %s', async (_label, pubdate) => {
      const f = vi.fn<FetchLike>(async () => json(esummary(record('1', { pubdate }))));
      const summary = (await fetchPubmedSummaries(['1'], f)).get('1');
      expect(summary).toBeDefined();
      expect(summary).not.toHaveProperty('year');
    });

    it('lists up to three authors and adds "et al." only when there are more', async () => {
      const authors = (n: number) =>
        Array.from({ length: n }, (_, i) => ({ name: `Author${i + 1} X`, authtype: 'Author' }));
      const f = vi.fn<FetchLike>(async () =>
        json(
          esummary(
            record('0', { authors: [] }),
            record('1', { authors: authors(1) }),
            record('2', { authors: authors(2) }),
            record('3', { authors: authors(3) }),
            record('4', { authors: authors(4) }),
          ),
        ),
      );
      const m = await fetchPubmedSummaries(['0', '1', '2', '3', '4'], f);
      expect(m.get('0')?.authors).toBe('');
      expect(m.get('1')?.authors).toBe('Author1 X');
      expect(m.get('2')?.authors).toBe('Author1 X, Author2 X');
      expect(m.get('3')?.authors).toBe('Author1 X, Author2 X, Author3 X');
      expect(m.get('4')?.authors).toBe('Author1 X, Author2 X, Author3 X, et al.');
    });

    it('falls back to empty values for missing or malformed optional fields', async () => {
      const f = vi.fn<FetchLike>(async () =>
        json({ result: { uids: ['1'], '1': { uid: '1', title: 'Only a title' } } }),
      );
      expect((await fetchPubmedSummaries(['1'], f)).get('1')).toEqual({
        title: 'Only a title',
        journalAbbrev: '',
        journal: '',
        authors: '',
        pubtypes: [],
      });

      const g = vi.fn<FetchLike>(async () =>
        json(
          esummary(
            record('2', {
              source: 5,
              fulljournalname: null,
              authors: 'Smith A',
              pubtype: ['Journal Article', 7, null],
            }),
            record('3', { authors: [{ name: 'Lee B' }, null, { name: 3 }, 'Kim C', { name: '' }] }),
          ),
        ),
      );
      const m = await fetchPubmedSummaries(['2', '3'], g);
      expect(m.get('2')).toEqual({
        title: 'Title 2',
        journalAbbrev: '',
        journal: '',
        year: 2020,
        authors: '',
        pubtypes: ['Journal Article'],
      });
      expect(m.get('3')?.authors).toBe('Lee B');
    });
  });
});

describe('pmcToPmid', () => {
  it('maps PMC ids to PMIDs', async () => {
    const f = vi.fn<FetchLike>(
      async () => new Response(JSON.stringify({ records: [{ pmcid: 'PMC3036345', pmid: 21326734 }] })),
    );
    expect(await pmcToPmid(['PMC3036345'], f)).toEqual(new Map([['PMC3036345', '21326734']]));
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(`${IDCONV_BASE}PMC3036345`);
  });

  it('batches several ids into one request', async () => {
    const f = vi.fn<FetchLike>(async () =>
      json({
        records: [
          { pmcid: 'PMC1', pmid: 11 },
          { pmcid: 'PMC2', pmid: 22 },
        ],
      }),
    );
    const m = await pmcToPmid(['PMC1', 'PMC2'], f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(`${IDCONV_BASE}PMC1,PMC2`);
    expect(m).toEqual(
      new Map([
        ['PMC1', '11'],
        ['PMC2', '22'],
      ]),
    );
  });

  it('skips records without a pmid', async () => {
    const f = vi.fn<FetchLike>(async () =>
      json({
        status: 'ok',
        records: [
          { pmcid: 'PMC1', status: 'error', errmsg: 'invalid article id' },
          { pmcid: 'PMC2', pmid: 22 },
          { pmcid: 'PMC3', pmid: null },
          { pmcid: 'PMC4', pmid: '' },
        ],
      }),
    );
    expect(await pmcToPmid(['PMC1', 'PMC2', 'PMC3', 'PMC4'], f)).toEqual(new Map([['PMC2', '22']]));
  });

  it('accepts a pmid given as a digit string', async () => {
    const f = vi.fn<FetchLike>(async () => json({ records: [{ pmcid: 'PMC1', pmid: '123' }] }));
    expect(await pmcToPmid(['PMC1'], f)).toEqual(new Map([['PMC1', '123']]));
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['fractional', 1.5],
    ['non-numeric text', 'abc'],
    ['an object', {}],
    ['a list', [1]],
  ])('skips a record whose pmid is %s', async (_label, pmid) => {
    const f = vi.fn<FetchLike>(async () => json({ records: [{ pmcid: 'PMC1', pmid }] }));
    expect(await pmcToPmid(['PMC1'], f)).toEqual(new Map());
  });

  it('skips records whose pmcid is missing or malformed', async () => {
    const f = vi.fn<FetchLike>(async () =>
      json({
        records: [
          { pmid: 1 },
          { pmcid: 5, pmid: 2 },
          { pmcid: 'PMCabc', pmid: 3 },
          { pmcid: 'PMC4,PMC5', pmid: 4 },
          null,
          'PMC6',
          { pmcid: 'PMC7', pmid: 7 },
        ],
      }),
    );
    expect(await pmcToPmid(['PMC7'], f)).toEqual(new Map([['PMC7', '7']]));
  });

  it('normalises PMC ids to upper case in the request and the result', async () => {
    const f = vi.fn<FetchLike>(async () => json({ records: [{ pmcid: 'PMC3036345', pmid: 21326734 }] }));
    const m = await pmcToPmid(['pmc3036345', 'PMC3036345'], f);
    expect(f.mock.calls[0][0]).toBe(`${IDCONV_BASE}PMC3036345`);
    expect(m).toEqual(new Map([['PMC3036345', '21326734']]));
  });

  it('passes the abort signal to fetch', async () => {
    const f = vi.fn<FetchLike>(async () => json({ records: [] }));
    const controller = new AbortController();
    await pmcToPmid(['PMC1'], f, controller.signal);
    expect(f.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  describe('never throws, returning an empty map', () => {
    it('on HTTP 429', async () => {
      const f = vi.fn<FetchLike>(async () => new Response('Too Many Requests', { status: 429 }));
      expect(await pmcToPmid(['PMC1'], f)).toEqual(new Map());
    });

    it('on HTTP 500 even with a valid-looking body', async () => {
      const f = vi.fn<FetchLike>(async () => json({ records: [{ pmcid: 'PMC1', pmid: 1 }] }, 500));
      expect(await pmcToPmid(['PMC1'], f)).toEqual(new Map());
    });

    it('on a network error', async () => {
      const f = vi.fn<FetchLike>(async () => {
        throw new TypeError('fetch failed');
      });
      expect(await pmcToPmid(['PMC1'], f)).toEqual(new Map());
    });

    it('when the request is aborted', async () => {
      const controller = new AbortController();
      const f = vi.fn<FetchLike>(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError')),
            );
          }),
      );
      const pending = pmcToPmid(['PMC1'], f, controller.signal);
      controller.abort();
      expect(await pending).toEqual(new Map());
    });

    it('on a malformed JSON body', async () => {
      const f = vi.fn<FetchLike>(async () => new Response('{"records": [oops'));
      expect(await pmcToPmid(['PMC1'], f)).toEqual(new Map());
    });

    it.each([
      ['null', null],
      ['an array', []],
      ['an empty object', {}],
      ['records as an object', { records: {} }],
      ['records as a string', { records: 'PMC1' }],
      ['a top-level error', { status: 'error', message: 'Invalid tool' }],
    ])('on an unexpected response shape (%s)', async (_label, body) => {
      const f = vi.fn<FetchLike>(async () => json(body));
      expect(await pmcToPmid(['PMC1'], f)).toEqual(new Map());
    });
  });

  it('makes no request for an empty id list', async () => {
    const f = vi.fn<FetchLike>(async () => json({ records: [] }));
    expect(await pmcToPmid([], f)).toEqual(new Map());
    expect(f).not.toHaveBeenCalled();
  });

  describe('id validation', () => {
    it('only sends ids shaped like PMC<digits>', async () => {
      const f = vi.fn<FetchLike>(async () => json({ records: [] }));
      await pmcToPmid(
        [
          'PMC3036345',
          '3036345',
          'PMC',
          'PMC12abc',
          'PMC1,PMC2',
          'PMC1&format=xml',
          ' PMC9',
          'PMC9 ',
          'XPMC9',
          '',
          5 as unknown as string,
          undefined as unknown as string,
        ],
        f,
      );
      expect(f).toHaveBeenCalledTimes(1);
      expect(f.mock.calls[0][0]).toBe(`${IDCONV_BASE}PMC3036345`);
    });

    it('makes no request when no id is valid', async () => {
      const f = vi.fn<FetchLike>(async () => json({ records: [] }));
      expect(await pmcToPmid(['3036345', 'PMC', 'PMC1,PMC2'], f)).toEqual(new Map());
      expect(f).not.toHaveBeenCalled();
    });
  });
});
