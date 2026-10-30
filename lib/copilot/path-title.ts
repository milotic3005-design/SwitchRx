import { isDomainTitle } from './source-types';
import type { EnrichedSource } from './types';

/** Path segments that say nothing about the page. */
const GENERIC_SEGMENTS = new Set([
  'index',
  'default',
  'home',
  'main',
  'en',
  'us',
  'en-us',
  'en_us',
  'us-en',
  'html',
  'htm',
  'www',
  'static',
  'pdf',
  'pdfs',
  'files',
  'assets',
  'content',
]);

/** How many segments, counted from the end of the path, make up a title. */
const MAX_PARTS = 2;

const FILE_EXTENSION = /\.[a-z][a-z0-9]{0,4}$/i;

/**
 * Whether a segment is an identifier rather than words: a long run of letters and digits with no
 * separators ("103772s5412lbl", "PMC4558633"), or hex digits split by dashes or underscores (UUIDs,
 * dates such as "2024-10-29").
 */
function isIdLike(text: string): boolean {
  if (/^[a-z0-9]{8,}$/i.test(text) && /\d/.test(text) && /[a-z]/i.test(text)) return true;
  return text.length >= 8 && /\d/.test(text) && /^[0-9a-f]+(?:[-_][0-9a-f]+)+$/i.test(text);
}

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/** One path segment as words, e.g. "dosage-admin" → "Dosage admin", or null when it carries none. */
function segmentWords(segment: string): string | null {
  const text = decode(segment).replace(FILE_EXTENSION, '').trim();
  if (GENERIC_SEGMENTS.has(text.toLowerCase()) || isIdLike(text)) return null;
  const words = text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // A segment of only digits or punctuation (a year, a page number) is not a title either.
  if (!/\p{L}/u.test(words)) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A readable title from a URL's path: its last one or two meaningful segments joined with " › ",
 * e.g. "Inflectra › Dosage admin" for https://www.pfizermedical.com/inflectra/dosage-admin. File
 * extensions are dropped, with " (PDF)" added for a PDF; generic and ID-like segments are skipped.
 * Null when nothing usable is left (or the URL does not parse).
 */
export function pathTitle(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const segments = pathname.split('/').filter(Boolean);
  const parts = segments.flatMap(segment => segmentWords(segment) ?? []).slice(-MAX_PARTS);
  if (parts.length === 0) return null;
  const isPdf = /\.pdf$/i.test(decode(segments[segments.length - 1]));
  return `${parts.join(' › ')}${isPdf ? ' (PDF)' : ''}`;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Gives each resolved source whose title is only a domain (most Gemini grounding titles) a title from
 * its URL path, so two pages on one site no longer read the same. When the path has nothing usable the
 * domain title is kept, unless it names a different host than the resolved link, in which case the
 * resolved host is used so the card agrees with the chip. Run after `titleFdaLabels`, so a matched FDA
 * label keeps its "prescribing information" title; PubMed records keep NCBI's title.
 */
export function titleWebSources(sources: EnrichedSource[]): EnrichedSource[] {
  return sources.map(source => {
    if (!source.url || source.pmid || !isDomainTitle(source.title)) return source;
    const title = pathTitle(source.url);
    if (title) return { ...source, title };

    const host = hostOf(source.url);
    const titleHost = source.title.trim().toLowerCase().replace(/^www\./, '');
    return host && host !== titleHost ? { ...source, title: host } : source;
  });
}
