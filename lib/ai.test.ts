import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamAI } from './ai';
import type { CitationSupport } from './ai';

function ndjsonResponse(events: unknown[], chunkSize = 17): Response {
  const bytes = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + '\n').join(''));
  // Split at arbitrary byte boundaries so the line buffering is exercised.
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
}

describe('streamAI supports', () => {
  afterEach(() => vi.unstubAllGlobals());

  const supports: CitationSupport[] = [{ text: 'Claim.', sourceIndices: [0] }];
  const events = [
    { type: 'text', delta: 'Claim.' },
    { type: 'sources', sources: [{ uri: 'u1', title: 'A' }] },
    { type: 'supports', supports },
    { type: 'done' },
  ];

  it('forwards supports events and sends thinkingLevel only when given', async () => {
    const fetchMock = vi.fn(async () => ndjsonResponse(events));
    vi.stubGlobal('fetch', fetchMock);

    const onSupports = vi.fn();
    const withLevel = await streamAI({
      system: 's', prompt: 'p', thinkingLevel: 'low', cb: { onSupports },
    });
    expect(onSupports).toHaveBeenCalledTimes(1);
    expect(onSupports).toHaveBeenCalledWith(supports);
    expect(withLevel.supports).toEqual(supports);
    expect(withLevel.text).toBe('Claim.');
    expect(withLevel.sources).toEqual([{ uri: 'u1', title: 'A' }]);
    const body1 = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body1.thinkingLevel).toBe('low');

    const withoutLevel = await streamAI({ system: 's', prompt: 'p' });
    expect(withoutLevel.supports).toEqual(supports);
    const body2 = JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect('thinkingLevel' in body2).toBe(false);
  });

  it('returns an empty supports list when the stream sends none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ndjsonResponse([{ type: 'text', delta: 'Hi' }, { type: 'done' }])));
    const r = await streamAI({ system: 's', prompt: 'p' });
    expect(r.supports).toEqual([]);
  });
});
