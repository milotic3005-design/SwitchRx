import type { CitationSupport } from '@/lib/ai';
import type { EnrichedSource } from './types';

export interface CitationPlacement {
  /** The answer with a ` [cite](#cite:<refNums>)` marker after each supported segment. */
  markdown: string;
  /** `refs[n - 1]` is the source index for reference `n`, numbered by first appearance. */
  refs: number[];
  /** How many supports could not be placed and were dropped. */
  unplaced: number;
  /**
   * Valid source indices named only by dropped supports (none of them is in `refs`), de-duplicated in
   * first-seen order, so the renderer can still list those sources under References.
   */
  uncited: number[];
}

const isEmphasis = (ch: string): boolean => ch === '*' || ch === '_';

interface Normalized {
  text: string;
  /** `origin[i]` is the index in the original string of `text[i]`. */
  origin: number[];
}

/**
 * Removes `*` and `_` and collapses whitespace runs to one space, so a segment still matches when the
 * body's emphasis markers or line breaks differ from the segment text the model reports. Case and all
 * other characters are kept exactly.
 */
function normalize(input: string): Normalized {
  const chars: string[] = [];
  const origin: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    if (isEmphasis(ch)) continue;
    if (/\s/.test(ch)) {
      if (chars[chars.length - 1] === ' ') continue;
      chars.push(' ');
    } else {
      chars.push(ch);
    }
    origin.push(i);
  }
  return { text: chars.join(''), origin };
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Whether the code point that ends just before `end` in `text` is a letter or digit. */
function wordBefore(text: string, end: number): boolean {
  if (end <= 0) return false;
  const low = text.charCodeAt(end - 1);
  const high = end >= 2 ? text.charCodeAt(end - 2) : 0;
  const paired = low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff;
  return WORD_CHAR.test(text.slice(paired ? end - 2 : end - 1, end));
}

/** Whether the code point that starts at `start` in `text` is a letter or digit. */
function wordAt(text: string, start: number): boolean {
  const codePoint = text.codePointAt(start);
  return codePoint !== undefined && WORD_CHAR.test(String.fromCodePoint(codePoint));
}

/** Whether index `i` falls between the two halves of a surrogate pair (a match must not start or end there). */
function splitsPair(text: string, i: number): boolean {
  if (i <= 0 || i >= text.length) return false;
  const low = text.charCodeAt(i);
  const high = text.charCodeAt(i - 1);
  return low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff;
}

/**
 * Whether a match of `needle` at `start` in the normalized body begins and ends on a word boundary:
 * the characters on either side must not be letters or digits, so `filtered.` does not match inside
 * `unfiltered.` and `Give 2.` does not match inside `Give 2.5`. Normalization deletes emphasis markers,
 * which can glue a match to a neighbouring span (`filter.**Bar**`); such a run still separates the two
 * when the needle itself ends in punctuation there, but never when it sits inside a word.
 */
function isWordBounded(flat: Normalized, body: string, start: number, needle: string): boolean {
  const end = start + needle.length;
  if (splitsPair(flat.text, start) || splitsPair(flat.text, end)) return false;
  if (wordBefore(flat.text, start)) {
    const separated = isEmphasis(body.charAt(flat.origin[start] - 1)) && !wordAt(needle, 0);
    if (!separated) return false;
  }
  if (wordAt(flat.text, end)) {
    const separated = isEmphasis(body.charAt(flat.origin[end - 1] + 1)) && !wordBefore(needle, needle.length);
    if (!separated) return false;
  }
  return true;
}

/** The start of the one word-bounded occurrence of `needle`, or -1 if there is none or more than one. */
function findUnique(flat: Normalized, body: string, needle: string): number {
  let found = -1;
  for (let at = flat.text.indexOf(needle); at >= 0; at = flat.text.indexOf(needle, at + 1)) {
    if (!isWordBounded(flat, body, at, needle)) continue;
    if (found >= 0) return -1;
    found = at;
  }
  return found;
}

function validIndices(indices: number[], sourceCount: number): number[] {
  const valid: number[] = [];
  for (const i of indices) {
    if (Number.isInteger(i) && i >= 0 && i < sourceCount && !valid.includes(i)) valid.push(i);
  }
  return valid;
}

/**
 * Inserts a citation marker after each segment of `body` that the model says a source supports.
 * A support is dropped rather than guessed at (counted in `unplaced`, its sources reported in
 * `uncited`) when it names no valid source, its text is not found on word boundaries, or that text
 * occurs more than once so the sentence it supports is ambiguous.
 */
export function placeCitations(body: string, supports: CitationSupport[], sourceCount: number): CitationPlacement {
  const flat = normalize(body);
  const sourcesAt = new Map<number, number[]>();
  const dropped: number[] = [];
  let unplaced = 0;

  for (const support of supports) {
    const indices = validIndices(support.sourceIndices, sourceCount);
    const needle = normalize(support.text).text.trim();
    const start = indices.length > 0 && needle.length > 0 ? findUnique(flat, body, needle) : -1;
    if (start < 0) {
      unplaced++;
      dropped.push(...indices);
      continue;
    }
    // Insert after the segment's last character, and past a run of emphasis markers that closes it
    // (end of text, whitespace or punctuation follows) but not one that opens the next span.
    let at = flat.origin[start + needle.length - 1] + 1;
    let afterRun = at;
    while (afterRun < body.length && isEmphasis(body.charAt(afterRun))) afterRun++;
    if (!wordAt(body, afterRun)) at = afterRun;

    const merged = sourcesAt.get(at) ?? [];
    for (const i of indices) if (!merged.includes(i)) merged.push(i);
    sourcesAt.set(at, merged);
  }

  const refs: number[] = [];
  let markdown = '';
  let cursor = 0;
  for (const [at, indices] of [...sourcesAt].sort(([a], [b]) => a - b)) {
    const refNums = indices.map(sourceIndex => {
      let pos = refs.indexOf(sourceIndex);
      if (pos < 0) pos = refs.push(sourceIndex) - 1;
      return pos + 1;
    });
    markdown += `${body.slice(cursor, at)} [cite](#cite:${refNums.join(',')})`;
    cursor = at;
  }
  markdown += body.slice(cursor);

  return { markdown, refs, unplaced, uncited: [...new Set(dropped)].filter(i => !refs.includes(i)) };
}

const CITE_HREF = /^#cite:([1-9]\d*(?:,[1-9]\d*)*)$/;

/** Reads the reference numbers out of a chip href, e.g. `'#cite:1,2'` gives `[1, 2]`. */
export function parseCiteHref(href: string): number[] | null {
  const match = CITE_HREF.exec(href);
  return match ? match[1].split(',').map(Number) : null;
}

function sourceFor(refNum: number, refs: number[], sources: EnrichedSource[]): EnrichedSource | undefined {
  const sourceIndex = refs[refNum - 1];
  return sourceIndex === undefined ? undefined : sources[sourceIndex];
}

/**
 * The text on a chip: the first source's short name, plus a count of the others, e.g. `'N Engl J Med + 1'`.
 * Reference numbers that do not resolve to a source are ignored; the label is empty if none do.
 */
export function chipLabel(refNums: number[], refs: number[], sources: EnrichedSource[]): string {
  const resolved = [...new Set(refNums)].flatMap(n => {
    const source = sourceFor(n, refs, sources);
    return source ? [source] : [];
  });
  if (resolved.length === 0) return '';
  const others = resolved.length - 1;
  return others > 0 ? `${resolved[0].shortName} + ${others}` : resolved[0].shortName;
}

const CITE_MARKER = /( ?)\[cite\]\(#cite:([^)\s]*)\)/g;

/** The answer as copyable text: chips become `[1, 2]` and a numbered References list is appended. */
export function toPlainText(markdown: string, refs: number[], sources: EnrichedSource[]): string {
  const text = markdown.replace(CITE_MARKER, (_marker, lead: string, nums: string) => {
    const resolved = (parseCiteHref(`#cite:${nums}`) ?? []).filter(n => sourceFor(n, refs, sources));
    return resolved.length > 0 ? `${lead}[${resolved.join(', ')}]` : '';
  });

  const lines = refs.flatMap((_, i) => {
    const n = i + 1;
    const s = sourceFor(n, refs, sources);
    if (!s) return [];
    return [`${n}. ${s.title} — ${s.journal || s.site}${s.year ? `, ${s.year}` : ''}.${s.url ? ` ${s.url}` : ''}`];
  });
  return lines.length > 0 ? `${text}\n\nReferences\n${lines.join('\n')}` : text;
}
