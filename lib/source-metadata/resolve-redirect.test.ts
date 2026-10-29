import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GROUNDING_REDIRECT_HOST,
  isAllowedGroundingUri,
  resolveRedirect,
  type FetchLike,
} from './resolve-redirect';

const R = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/x';

const redirect = (location: string | null, status = 302) =>
  new Response(null, {
    status,
    headers: location === null ? {} : { Location: location },
  });

afterEach(() => {
  vi.useRealTimers();
});

describe('GROUNDING_REDIRECT_HOST', () => {
  it('is exactly the Vertex AI Search grounding host', () => {
    expect(GROUNDING_REDIRECT_HOST).toBe('vertexaisearch.cloud.google.com');
  });
});

describe('isAllowedGroundingUri', () => {
  it.each([
    ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/x', true],
    ['http://vertexaisearch.cloud.google.com/grounding-api-redirect/x', false],
    ['https://evil.example/x', false],
    ['https://vertexaisearch.cloud.google.com.evil.com/x', false],
    ['not a url', false],
  ])('isAllowedGroundingUri(%s) → %s', (u, ok) => expect(isAllowedGroundingUri(u)).toBe(ok));

  it.each([
    // userinfo tricks: the real host is what follows the "@"
    ['https://vertexaisearch.cloud.google.com@evil.com/x'],
    ['https://vertexaisearch.cloud.google.com:pw@evil.com/x'],
    ['https://evil.com@vertexaisearch.cloud.google.com/x'],
    ['https://user:pw@vertexaisearch.cloud.google.com/x'],
    // backslash is treated as a slash by WHATWG URL for https
    ['https://evil.com\\@vertexaisearch.cloud.google.com/x'],
    // prefix, suffix, parent and sibling hosts
    ['https://evilvertexaisearch.cloud.google.com/x'],
    ['https://notvertexaisearch.cloud.google.com/x'],
    ['https://sub.vertexaisearch.cloud.google.com/x'],
    ['https://cloud.google.com/x'],
    ['https://vertexaisearch.cloud.google.com.evil.com/x'],
    ['https://vertexaisearch.cloud.google.com%2eevil.com/x'],
    ['https://vertexaisearch.cloud.google.com./x'],
    // the allowed host appearing only in the path, query, or fragment
    ['https://evil.example/https://vertexaisearch.cloud.google.com/x'],
    ['https://evil.example/?u=https://vertexaisearch.cloud.google.com/x'],
    ['https://evil.example/#https://vertexaisearch.cloud.google.com/x'],
    // other ports
    ['https://vertexaisearch.cloud.google.com:8443/x'],
    ['https://vertexaisearch.cloud.google.com:80/x'],
    // other schemes, relative and malformed inputs
    ['ftp://vertexaisearch.cloud.google.com/x'],
    ['javascript:alert(1)//vertexaisearch.cloud.google.com'],
    ['//vertexaisearch.cloud.google.com/x'],
    ['/grounding-api-redirect/x'],
    ['vertexaisearch.cloud.google.com/x'],
    [''],
    ['   '],
  ])('rejects %s', (u) => expect(isAllowedGroundingUri(u)).toBe(false));

  it('rejects non-string input without throwing', () => {
    for (const bad of [undefined, null, 42, {}, ['https://vertexaisearch.cloud.google.com/x']]) {
      expect(isAllowedGroundingUri(bad as unknown as string)).toBe(false);
    }
  });

  it('accepts the same origin written with a different case or the default https port', () => {
    expect(isAllowedGroundingUri('HTTPS://VertexAISearch.Cloud.Google.COM/x')).toBe(true);
    expect(isAllowedGroundingUri('https://vertexaisearch.cloud.google.com:443/x')).toBe(true);
  });
});

describe('resolveRedirect', () => {
  it('returns the Location of a redirect without following it', async () => {
    const f = vi.fn<FetchLike>(async () => redirect('https://pubmed.ncbi.nlm.nih.gov/16914701/'));
    expect(await resolveRedirect(R, f)).toBe('https://pubmed.ncbi.nlm.nih.gov/16914701/');
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(R);
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: 'manual', method: 'GET' });
  });

  it('never requests the destination: a redirect to another host is returned, not fetched', async () => {
    const f = vi.fn<FetchLike>(async () => redirect('https://evil.example/steal'));
    expect(await resolveRedirect(R, f)).toBe('https://evil.example/steal');
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(R);
  });

  it('resolves a relative Location against the request URL', async () => {
    const f = vi.fn<FetchLike>(async () => redirect('/a/b'));
    expect(await resolveRedirect(R, f)).toBe('https://vertexaisearch.cloud.google.com/a/b');
  });

  it.each([301, 302, 303, 307, 308])('accepts redirect status %i', async (status) => {
    const f = vi.fn<FetchLike>(async () => redirect('https://pubmed.ncbi.nlm.nih.gov/1/', status));
    expect(await resolveRedirect(R, f)).toBe('https://pubmed.ncbi.nlm.nih.gov/1/');
  });

  it.each([200, 204, 300, 304, 404, 500])(
    'returns null for non-redirect status %i even when a Location header is present',
    async (status) => {
      const f = vi.fn<FetchLike>(async () => redirect('https://pubmed.ncbi.nlm.nih.gov/1/', status));
      expect(await resolveRedirect(R, f)).toBeNull();
      expect(f).toHaveBeenCalledTimes(1);
    },
  );

  it('returns null for a redirect without a Location (missing or empty)', async () => {
    expect(await resolveRedirect(R, vi.fn<FetchLike>(async () => redirect(null)))).toBeNull();
    expect(await resolveRedirect(R, vi.fn<FetchLike>(async () => redirect('')))).toBeNull();
  });

  it('returns null and never fetches for a disallowed URI', async () => {
    const f = vi.fn<FetchLike>(async () => redirect('https://pubmed.ncbi.nlm.nih.gov/1/'));
    for (const bad of [
      'https://evil.example',
      'http://vertexaisearch.cloud.google.com/x',
      'https://vertexaisearch.cloud.google.com.evil.com/x',
      'https://vertexaisearch.cloud.google.com@evil.com/x',
      'https://user@vertexaisearch.cloud.google.com/x',
      'https://vertexaisearch.cloud.google.com:8443/x',
      'not a url',
      '',
    ]) {
      expect(await resolveRedirect(bad, f)).toBeNull();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('returns null when the timeout elapses, aborting the request', async () => {
    const hang: FetchLike = (_u, init) =>
      new Promise((_r, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted'))));
    expect(await resolveRedirect(R, hang, 20)).toBeNull();

    let signal: AbortSignal | undefined;
    const spy: FetchLike = (_u, init) => {
      signal = init!.signal!;
      return new Promise((_r, rej) => signal!.addEventListener('abort', () => rej(new Error('aborted'))));
    };
    expect(await resolveRedirect(R, spy, 20)).toBeNull();
    expect(signal!.aborted).toBe(true);
  });

  it('defaults the timeout to 4000 ms', async () => {
    vi.useFakeTimers();
    const hang: FetchLike = (_u, init) =>
      new Promise((_r, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted'))));
    const result = resolveRedirect(R, hang);
    await vi.advanceTimersByTimeAsync(3999);
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBeNull();
  });

  it('clears its timer after a successful response and after a failure', async () => {
    vi.useFakeTimers();
    expect(await resolveRedirect(R, async () => redirect('/a/b'))).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(
      await resolveRedirect(R, async () => {
        throw new Error('network down');
      }),
    ).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not leave the redirect response body open', async () => {
    const cancelled = vi.fn();
    const f: FetchLike = async () =>
      new Response(new ReadableStream({ cancel: cancelled }), {
        status: 302,
        headers: { Location: '/a/b' },
      });
    expect(await resolveRedirect(R, f)).toBe('https://vertexaisearch.cloud.google.com/a/b');
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('never throws: network errors, sync throws, bad Locations, and bogus responses all give null', async () => {
    const rejecting: FetchLike = () => Promise.reject(new Error('ECONNRESET'));
    const throwing: FetchLike = () => {
      throw new Error('boom');
    };
    const bogus = (async () => undefined) as unknown as FetchLike;
    const badLocation: FetchLike = async () => redirect('http://[');
    await expect(resolveRedirect(R, rejecting)).resolves.toBeNull();
    await expect(resolveRedirect(R, throwing)).resolves.toBeNull();
    await expect(resolveRedirect(R, bogus)).resolves.toBeNull();
    await expect(resolveRedirect(R, badLocation)).resolves.toBeNull();
    await expect(resolveRedirect(undefined as unknown as string, rejecting)).resolves.toBeNull();
  });
});
