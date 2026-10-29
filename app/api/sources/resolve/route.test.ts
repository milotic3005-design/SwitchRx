import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/lib/source-metadata/__fixtures__/esummary-16914701.json';
import { dynamic, POST, runtime } from './route';

const post = (body: string) =>
  POST(new Request('http://x/api/sources/resolve', { method: 'POST', body }));

const sourcesBody = (sources: unknown) => JSON.stringify({ sources });

/** Spies on global fetch and fails loudly instead of ever reaching the network. */
const blockNetwork = () =>
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network access is not allowed in tests'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/sources/resolve', () => {
  it('runs on the Node runtime and is never statically cached', () => {
    expect(runtime).toBe('nodejs');
    expect(dynamic).toBe('force-dynamic');
  });

  it('rejects bad bodies with 400', async () => {
    const spy = blockNetwork();
    for (const body of [
      'not json',
      JSON.stringify({}),
      JSON.stringify({ sources: Array(41).fill({ uri: 'u', title: 't' }) }),
      JSON.stringify({ sources: [{ uri: 1 }] }),
    ]) {
      expect((await POST(new Request('http://x/api/sources/resolve', { method: 'POST', body }))).status).toBe(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    ['null', 'null'],
    ['a number', '5'],
    ['a string', '"sources"'],
    ['an array', '[]'],
    ['sources that is not an array', sourcesBody('x')],
    ['an empty sources array', sourcesBody([])],
    ['a null item', sourcesBody([null])],
    ['a non-object item', sourcesBody(['https://vertexaisearch.cloud.google.com/x'])],
    ['an array item', sourcesBody([['u', 't']])],
    ['a missing uri', sourcesBody([{ title: 't' }])],
    ['a missing title', sourcesBody([{ uri: 'u' }])],
    ['a non-string uri', sourcesBody([{ uri: 1, title: 't' }])],
    ['a non-string title', sourcesBody([{ uri: 'u', title: null }])],
    ['one bad item among good ones', sourcesBody([{ uri: 'u', title: 't' }, { uri: 'u' }])],
    ['an empty body', ''],
  ])('rejects %s with a short plain-text 400', async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect(text.length).toBeLessThan(120);
  });

  it('accepts exactly 40 sources', async () => {
    const spy = blockNetwork();
    const sources = Array.from({ length: 40 }, (_, i) => ({ uri: `https://evil.example/${i}`, title: 'cdc.gov' }));
    const res = await post(sourcesBody(sources));
    expect(res.status).toBe(200);
    expect((await res.json()).sources).toHaveLength(40);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns fallbacks for disallowed URIs without fetching', async () => {
    const spy = blockNetwork();
    const res = await POST(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ sources: [{ uri: 'https://evil.example/a', title: 'cdc.gov' }] }),
      }),
    );
    expect((await res.json()).sources[0]).toMatchObject({ url: null, shortName: 'CDC', type: 'agency' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('resolves allowed grounding links through the global fetch and responds with JSON { sources }', async () => {
    const uri = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/route-test';
    const requested: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      requested.push(url);
      if (url === uri) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://pubmed.ncbi.nlm.nih.gov/16914701/' },
        });
      }
      if (url.startsWith('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?')) {
        return new Response(JSON.stringify(fixture), { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    });

    const res = await post(
      sourcesBody([{ uri, title: 'pubmed.ncbi.nlm.nih.gov', ignored: 'extra field' }]),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    const { sources } = await res.json();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      uri,
      url: 'https://pubmed.ncbi.nlm.nih.gov/16914701/',
      pmid: '16914701',
      shortName: 'N Engl J Med',
      year: 2006,
      type: 'trial',
    });
    expect(requested).toHaveLength(2);
  });
});
