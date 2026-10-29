/**
 * Turns the web-search sources an AI answer cited (Gemini grounding redirect links) into
 * verified reference details: real URL, site, type and, for PubMed / PMC articles, title,
 * journal, year and authors.
 *
 * The input comes from the browser, so the only outbound requests made here are the
 * allowlisted redirect lookup (`resolveRedirect`) and NCBI API calls with IDs parsed from
 * the resolved URLs. A resolved destination page is never fetched.
 *
 * Every source starts as `fallbackSource(src)` and is replaced only once it has been fully
 * enriched, so whatever is unfinished when the overall budget runs out (or when a lookup
 * fails) degrades to the fallback. Nothing here throws.
 */

import type { GroundingSource } from '@/lib/ai';
import { classifySource, fallbackSource, siteShortName } from '@/lib/copilot/source-types';
import type { EnrichedSource } from '@/lib/copilot/types';
import { fetchPubmedSummaries, parseArticleId, pmcToPmid, type PubmedSummary } from './ncbi';
import { isAllowedGroundingUri, resolveRedirect, type FetchLike } from './resolve-redirect';

export interface EnrichDeps {
  fetchImpl: FetchLike;
  /** Enriched results by grounding URI. Defaults to a module-level cache. */
  cache?: Map<string, { value: EnrichedSource; expires: number }>;
  /** Clock used for cache expiry. Defaults to `Date.now`. */
  now?: () => number;
}

export interface EnrichOptions {
  /** Budget for resolving one redirect. Default 4000 ms. */
  perLinkTimeoutMs?: number;
  /** Budget for the whole call. Default 10 000 ms. */
  totalTimeoutMs?: number;
}

type Cache = NonNullable<EnrichDeps['cache']>;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Oldest entries are dropped beyond this, so the long-lived default cache cannot grow without bound. */
export const MAX_CACHE_ENTRIES = 500;
const MAX_CONCURRENT_LINKS = 6;
const DEFAULT_PER_LINK_TIMEOUT_MS = 4000;
const DEFAULT_TOTAL_TIMEOUT_MS = 10_000;

const defaultCache: Cache = new Map();

function readCache(cache: Cache, key: string, now: number): EnrichedSource | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires <= now) {
    cache.delete(key);
    return null;
  }
  return { ...entry.value };
}

function writeCache(cache: Cache, key: string, value: EnrichedSource, now: number): void {
  cache.delete(key); // re-insert so a refreshed entry counts as the newest
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
  cache.set(key, { value: { ...value }, expires: now + CACHE_TTL_MS });
}

/** Runs `worker` over `items`, at most `limit` at a time, and stops starting new ones once aborted. */
async function forEachLimit<T>(
  items: T[],
  limit: number,
  signal: AbortSignal,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length && !signal.aborted) {
      await worker(items[next++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

/** `fallback` plus what the resolved destination URL proves: its link, site, type and short name. */
function withDestination(fallback: EnrichedSource, url: string): EnrichedSource {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return {
    ...fallback,
    url,
    site: host,
    shortName: siteShortName(host),
    type: classifySource({ host }),
  };
}

/** `base` plus the verified PubMed record for `pmid`. */
function withPubmed(base: EnrichedSource, pmid: string, summary: PubmedSummary): EnrichedSource {
  return {
    ...base,
    title: summary.title,
    shortName: summary.journalAbbrev || base.shortName,
    ...(summary.journal ? { journal: summary.journal } : {}),
    ...(summary.year !== undefined ? { year: summary.year } : {}),
    ...(summary.authors ? { authors: summary.authors } : {}),
    pmid,
    type: classifySource({ host: base.site, pubtypes: summary.pubtypes }),
  };
}

const unique = (values: string[]): string[] => [...new Set(values)];

/** A source whose redirect resolved to a PubMed or PMC article, waiting on NCBI metadata. */
interface AwaitingNcbi {
  index: number;
  base: EnrichedSource;
  ids: { pmid?: string; pmcid?: string };
}

/**
 * Enriches `sources`, returning an array of the same length and order.
 *
 * The whole call is raced against `totalTimeoutMs` regardless of whether any fetch honors its
 * `AbortSignal`; when the budget elapses, in-flight work is aborted and sources that had not
 * finished are returned as fallbacks. Only fully enriched results are cached (24 h), so a
 * fallback caused by a timeout or failure never blocks a later request from succeeding.
 */
export async function enrichSources(
  sources: GroundingSource[],
  deps: EnrichDeps,
  opts: EnrichOptions = {},
): Promise<EnrichedSource[]> {
  const { fetchImpl, cache = defaultCache, now = Date.now } = deps;
  const perLinkTimeoutMs = opts.perLinkTimeoutMs ?? DEFAULT_PER_LINK_TIMEOUT_MS;
  const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;

  // A slot is replaced only when its source has finished; until then it is the fallback.
  const results = sources.map(fallbackSource);

  const controller = new AbortController();
  const { signal } = controller;

  // resolveRedirect aborts on its own per-link timer; also abort it when the budget is spent.
  const redirectFetch: FetchLike = (input, init) =>
    fetchImpl(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal,
    });

  const finish = (index: number, value: EnrichedSource, cacheable: boolean) => {
    if (signal.aborted) return;
    results[index] = value;
    if (cacheable) writeCache(cache, sources[index].uri, value, now());
  };

  const enrichAll = async () => {
    // Serve what is cached; only allowlisted grounding URIs are ever looked up.
    const toResolve: number[] = [];
    const startedAt = now();
    sources.forEach((src, i) => {
      if (!isAllowedGroundingUri(src.uri)) return;
      const hit = readCache(cache, src.uri, startedAt);
      if (hit) results[i] = hit;
      else toResolve.push(i);
    });

    // Stage 1: resolve each redirect (a few at a time).
    const awaiting: AwaitingNcbi[] = [];
    await forEachLimit(toResolve, MAX_CONCURRENT_LINKS, signal, async (i) => {
      const url = await resolveRedirect(sources[i].uri, redirectFetch, perLinkTimeoutMs);
      if (url === null || signal.aborted) return;
      const base = withDestination(results[i], url);
      const ids = parseArticleId(url);
      if (ids.pmid || ids.pmcid) awaiting.push({ index: i, base, ids });
      else finish(i, base, true);
    });
    if (awaiting.length === 0 || signal.aborted) return;

    // Stage 2: one PMC-to-PMID conversion and one PubMed summary lookup for all sources.
    const pmcids = unique(awaiting.flatMap((a) => (a.ids.pmcid ? [a.ids.pmcid] : [])));
    const pmidByPmcid = pmcids.length > 0 ? await pmcToPmid(pmcids, fetchImpl, signal) : new Map<string, string>();
    // The map is keyed by upper-case PMC id, which is what parseArticleId returns.
    const pmidOf = (a: AwaitingNcbi): string | undefined =>
      a.ids.pmid ?? (a.ids.pmcid ? pmidByPmcid.get(a.ids.pmcid) : undefined);

    const pmids = unique(awaiting.flatMap((a) => pmidOf(a) ?? []));
    const summaries =
      pmids.length > 0 && !signal.aborted
        ? await fetchPubmedSummaries(pmids, fetchImpl, signal)
        : new Map<string, PubmedSummary>();

    for (const a of awaiting) {
      const pmid = pmidOf(a);
      const summary = pmid ? summaries.get(pmid) : undefined;
      // Without a PubMed record the verified link is still returned, but it is not cached:
      // the lookup may have failed transiently and a later request should retry it.
      if (pmid && summary) finish(a.index, withPubmed(a.base, pmid, summary), true);
      else finish(a.index, a.base, false);
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, totalTimeoutMs);
  });

  try {
    // An unexpected error in a dependency only costs the unfinished sources their enrichment.
    await Promise.race([enrichAll().catch(() => {}), budget]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  return results.slice();
}
