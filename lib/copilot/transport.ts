import { streamAI, type GroundingSource } from '@/lib/ai';
import { runPharmacyLookup } from '@/lib/pharmacy-lookup';
import type { CopilotTransport } from './run-turn';
import { fallbackSource } from './source-types';
import type { EnrichedSource } from './types';

const RESOLVE_URL = '/api/sources/resolve';
// The resolve route rejects the whole request if any of these limits is exceeded.
const MAX_RESOLVE_SOURCES = 40;
const MAX_URI_LENGTH = 2048;
const MAX_TITLE_LENGTH = 500;

/**
 * Enriches `sources` through the resolve route, returning a list of the same length and order.
 * A source that cannot be sent (an over-long link, or beyond the first 40 sendable ones) keeps its
 * fallback. Throws if the request fails, so the caller can keep its fallbacks for every source.
 */
async function resolveSources(sources: GroundingSource[], signal: AbortSignal): Promise<EnrichedSource[]> {
  const result = sources.map(fallbackSource);

  const positions: number[] = [];
  const payload: GroundingSource[] = [];
  sources.forEach((src, i) => {
    if (payload.length >= MAX_RESOLVE_SOURCES || src.uri.length > MAX_URI_LENGTH) return;
    positions.push(i);
    payload.push({ uri: src.uri, title: src.title.slice(0, MAX_TITLE_LENGTH) });
  });
  if (payload.length === 0) return result;

  const res = await fetch(RESOLVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources: payload }),
    signal,
  });
  if (!res.ok) throw new Error(`Source resolution failed (${res.status} ${res.statusText})`);

  const body = (await res.json()) as { sources?: unknown };
  if (!Array.isArray(body.sources)) throw new Error('Source resolution returned no sources');
  const enriched = body.sources as (EnrichedSource | null | undefined)[];
  positions.forEach((at, k) => {
    const source = enriched[k];
    if (source) result[at] = source;
  });
  return result;
}

/** The production transport: pharmacy lookup, Gemini answer stream, and source resolution route. */
export const realTransport: CopilotTransport = {
  // runPharmacyLookup cannot be cancelled; runTurn stops waiting for it when the turn is aborted.
  lookup: (question) => runPharmacyLookup(question),

  stream: async (req, cb, signal) => {
    await streamAI({
      system: req.system,
      prompt: req.messages,
      maxTokens: 8000,
      webSearch: true,
      thinkingLevel: req.thinkingLevel,
      cb: {
        onText: (full) => cb.onText(full),
        onSources: (list) => cb.onSources(list),
        onSupports: (list) => cb.onSupports(list),
      },
      signal,
    });
  },

  resolve: resolveSources,
};
