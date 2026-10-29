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
import type { EnrichedSource, SourceType } from '@/lib/copilot/types';
import { fetchPubmedSummaries, parseArticleId, pmcToPmid, type PubmedSummary } from './ncbi';
import { isAllowedGroundingUri, resolveRedirect, type FetchLike } from './resolve-redirect';

/**
 * The part of an enriched source that the server derived itself: the resolved link, site and
 * type, plus NCBI's own title/journal/year/authors/pmid for PubMed articles. Nothing in here
 * is copied from the request, so it is safe to share between requests. `title` is present only
 * when it came from NCBI (together with `pmid`); otherwise the request's title is kept.
 */
export interface DerivedSource {
  url: string;
  site: string;
  shortName: string;
  type: SourceType;
  title?: string;
  journal?: string;
  year?: number;
  authors?: string;
  pmid?: string;
}

export interface EnrichDeps {
  fetchImpl: FetchLike;
  /**
   * Server-derived fields by normalized grounding URL (no fragment). Defaults to a
   * module-level cache. Never holds text copied from a request.
   */
  cache?: Map<string, { value: DerivedSource; expires: number }>;
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

function readCache(cache: Cache, key: string, now: number): DerivedSource | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires <= now) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(cache: Cache, key: string, value: DerivedSource, now: number): void {
  cache.delete(key); // re-insert so a refreshed entry counts as the newest
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
  cache.set(key, { value, expires: now + CACHE_TTL_MS });
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

/**
 * The cache key and the URL that is actually requested: a valid grounding URI with its
 * fragment removed (fetch never sends one, so `x#1` and `x#2` are the same request), or
 * `null` when the URI may not be requested at all.
 */
function normalizeGroundingUri(uri: string): string | null {
  if (!isAllowedGroundingUri(uri)) return null;
  const url = new URL(uri);
  url.hash = '';
  return url.toString();
}

/** What the resolved destination URL proves: its link, site, type and short name. */
function fromDestination(url: string): DerivedSource {
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return { url, site: host, shortName: siteShortName(host), type: classifySource({ host }) };
}

/** `dest` plus the verified PubMed record for `pmid`. */
function withPubmed(dest: DerivedSource, pmid: string, summary: PubmedSummary): DerivedSource {
  return {
    ...dest,
    title: summary.title,
    shortName: summary.journalAbbrev || dest.shortName,
    ...(summary.journal ? { journal: summary.journal } : {}),
    ...(summary.year !== undefined ? { year: summary.year } : {}),
    ...(summary.authors ? { authors: summary.authors } : {}),
    pmid,
    type: classifySource({ host: dest.site, pubtypes: summary.pubtypes }),
  };
}

/** The enriched source for this request: its own fallback with the derived fields laid over it. */
const enriched = (src: GroundingSource, derived: DerivedSource): EnrichedSource => ({
  ...fallbackSource(src),
  ...derived,
});

const unique = (values: string[]): string[] => [...new Set(values)];

/** A source whose redirect resolved to a PubMed or PMC article, waiting on NCBI metadata. */
interface AwaitingNcbi {
  index: number;
  key: string;
  dest: DerivedSource;
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

  const finish = (index: number, key: string, derived: DerivedSource, cacheable: boolean) => {
    if (signal.aborted) return;
    results[index] = enriched(sources[index], derived);
    if (cacheable) writeCache(cache, key, derived, now());
  };

  const enrichAll = async () => {
    // Serve what is cached; only allowlisted grounding URIs are ever looked up.
    const toResolve: { index: number; key: string }[] = [];
    const startedAt = now();
    sources.forEach((src, index) => {
      const key = normalizeGroundingUri(src.uri);
      if (key === null) return;
      const hit = readCache(cache, key, startedAt);
      if (hit) results[index] = enriched(src, hit);
      else toResolve.push({ index, key });
    });

    // Stage 1: resolve each redirect (a few at a time). The key is the URL that is requested.
    const awaiting: AwaitingNcbi[] = [];
    await forEachLimit(toResolve, MAX_CONCURRENT_LINKS, signal, async ({ index, key }) => {
      const url = await resolveRedirect(key, redirectFetch, perLinkTimeoutMs);
      if (url === null || signal.aborted) return;
      const dest = fromDestination(url);
      const ids = parseArticleId(url);
      if (ids.pmid || ids.pmcid) awaiting.push({ index, key, dest, ids });
      else finish(index, key, dest, true);
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
      if (pmid && summary) finish(a.index, a.key, withPubmed(a.dest, pmid, summary), true);
      else finish(a.index, a.key, a.dest, false);
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
