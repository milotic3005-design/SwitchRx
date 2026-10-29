/**
 * NCBI client: verified citation metadata for PubMed / PMC articles.
 *
 * - `parseArticleId` pulls a PMID or PMCID out of a PubMed/PMC article URL.
 * - `fetchPubmedSummaries` turns PMIDs into title/journal/year/authors (E-utilities esummary).
 * - `pmcToPmid` maps PMC IDs to PMIDs (PMC ID Converter).
 *
 * Only digit-only PMIDs and `PMC<digits>` IDs are ever placed in a request URL, and every
 * request carries `tool=switchrx`. Nothing here throws: any HTTP error (including 429),
 * network error, abort, malformed JSON or unexpected shape yields an empty map.
 */

import type { FetchLike } from './resolve-redirect';

const ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
const IDCONV_URL = 'https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/';

const PMID_RE = /^\d+$/;
const PMCID_RE = /^PMC\d+$/i;

const MAX_LISTED_AUTHORS = 3;

export interface PubmedSummary {
  title: string;
  /** NLM journal abbreviation, e.g. "N Engl J Med". */
  journalAbbrev: string;
  /** Full journal name, e.g. "The New England journal of medicine". */
  journal: string;
  year?: number;
  /** First three authors, followed by "et al." when there are more. */
  authors: string;
  pubtypes: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

// --- parseArticleId --------------------------------------------------------------------

const PUBMED_HOST = 'pubmed.ncbi.nlm.nih.gov';
const NCBI_HOSTS = new Set(['ncbi.nlm.nih.gov', 'www.ncbi.nlm.nih.gov']);
const PMC_HOST = 'pmc.ncbi.nlm.nih.gov';

/**
 * Extracts a PMID or PMCID (upper-cased) from a PubMed or PMC article URL.
 * Returns `{}` for anything else, including NCBI-lookalike hosts.
 */
export function parseArticleId(url: string): { pmid?: string; pmcid?: string } {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return {};
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return {};

  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  if (host === PUBMED_HOST) {
    const m = /^\/(\d+)\/?$/.exec(path);
    return m ? { pmid: m[1] } : {};
  }
  if (NCBI_HOSTS.has(host)) {
    const pubmed = /^\/pubmed\/(\d+)\/?$/.exec(path);
    if (pubmed) return { pmid: pubmed[1] };
    const pmc = /^\/pmc\/articles\/(PMC\d+)(?:\/|$)/i.exec(path);
    if (pmc) return { pmcid: pmc[1].toUpperCase() };
    return {};
  }
  if (host === PMC_HOST) {
    const pmc = /^\/articles\/(PMC\d+)(?:\/|$)/i.exec(path);
    return pmc ? { pmcid: pmc[1].toUpperCase() } : {};
  }
  return {};
}

// --- shared request helper -------------------------------------------------------------

/** GETs `url` and returns the parsed JSON body, or `null` on any failure. */
async function getJson(
  url: string,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    const res = await fetchImpl(url, { method: 'GET', signal });
    if (!res.ok) {
      // Release the connection without reading the body.
      res.body?.cancel().catch(() => {});
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

/** Keeps only strings matching `re`, de-duplicated, in first-seen order. */
function validIds(ids: readonly unknown[], re: RegExp, normalize: (id: string) => string) {
  const out = new Set<string>();
  for (const id of ids) {
    if (typeof id === 'string' && re.test(id)) out.add(normalize(id));
  }
  return [...out];
}

// --- fetchPubmedSummaries --------------------------------------------------------------

function formatAuthors(authors: unknown): string {
  if (!Array.isArray(authors)) return '';
  const names: string[] = [];
  for (const a of authors) {
    if (isRecord(a) && typeof a.name === 'string' && a.name !== '') names.push(a.name);
  }
  const listed = names.slice(0, MAX_LISTED_AUTHORS).join(', ');
  return names.length > MAX_LISTED_AUTHORS ? `${listed}, et al.` : listed;
}

function parseSummary(raw: unknown): PubmedSummary | null {
  if (!isRecord(raw) || raw.error !== undefined) return null;
  if (typeof raw.title !== 'string' || raw.title === '') return null;

  const summary: PubmedSummary = {
    title: raw.title,
    journalAbbrev: asString(raw.source),
    journal: asString(raw.fulljournalname),
    authors: formatAuthors(raw.authors),
    pubtypes: Array.isArray(raw.pubtype)
      ? raw.pubtype.filter((t): t is string => typeof t === 'string')
      : [],
  };
  const year = /^\s*(\d{4})/.exec(asString(raw.pubdate));
  if (year) summary.year = Number(year[1]);
  return summary;
}

/** Looks up PubMed summaries for `pmids` in one request. Keys are the requested PMIDs. */
export async function fetchPubmedSummaries(
  pmids: string[],
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<Map<string, PubmedSummary>> {
  const out = new Map<string, PubmedSummary>();
  const ids = validIds(pmids, PMID_RE, (id) => id);
  if (ids.length === 0) return out;

  const body = await getJson(
    `${ESUMMARY_URL}?db=pubmed&retmode=json&tool=switchrx&id=${ids.join(',')}`,
    fetchImpl,
    signal,
  );
  if (!isRecord(body) || !isRecord(body.result)) return out;

  for (const id of ids) {
    const summary = parseSummary(body.result[id]);
    if (summary) out.set(id, summary);
  }
  return out;
}

// --- pmcToPmid -------------------------------------------------------------------------

/** Accepts a positive integer, or a digit string, and returns it as a string. */
function asPmid(v: unknown): string | null {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v > 0 ? String(v) : null;
  if (typeof v === 'string' && PMID_RE.test(v) && Number(v) > 0) return v;
  return null;
}

/** Maps PMC IDs (upper-cased) to PMIDs in one request; IDs with no PMID are omitted. */
export async function pmcToPmid(
  pmcids: string[],
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = validIds(pmcids, PMCID_RE, (id) => id.toUpperCase());
  if (ids.length === 0) return out;

  const body = await getJson(
    `${IDCONV_URL}?format=json&tool=switchrx&ids=${ids.join(',')}`,
    fetchImpl,
    signal,
  );
  if (!isRecord(body) || !Array.isArray(body.records)) return out;

  for (const rec of body.records) {
    if (!isRecord(rec) || typeof rec.pmcid !== 'string' || !PMCID_RE.test(rec.pmcid)) continue;
    const pmid = asPmid(rec.pmid);
    if (pmid) out.set(rec.pmcid.toUpperCase(), pmid);
  }
  return out;
}
