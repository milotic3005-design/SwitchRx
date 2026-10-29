import type { CitationSupport } from '@/lib/ai';
import type { EnrichedSource } from './types';

export interface CitationPlacement {
  /** The answer with a ` [cite](#cite:<refNums>)` marker after each supported segment. */
  markdown: string;
  /** `refs[n - 1]` is the source index for reference `n`, numbered by first appearance. */
  refs: number[];
  /** How many supports could not be placed and were dropped. */
  unplaced: number;
}

const isEmphasis = (ch: string): boolean => ch === '*' || ch === '_';

/**
 * Removes `*` and `_` and collapses whitespace runs to one space, so a segment still matches when the
 * body's emphasis markers or line breaks differ from the segment text the model reports. Case and all
 * other characters are kept exactly. `origin[i]` is the index in `input` of `text[i]`.
 */
function normalize(input: string): { text: string; origin: number[] } {
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

function validIndices(indices: number[], sourceCount: number): number[] {
  const valid: number[] = [];
  for (const i of indices) {
    if (Number.isInteger(i) && i >= 0 && i < sourceCount && !valid.includes(i)) valid.push(i);
  }
  return valid;
}

/**
 * Inserts a citation marker after each segment of `body` that the model says a source supports.
 * A support is dropped (counted in `unplaced`) rather than guessed at when it names no valid source
 * or its text cannot be found in the body.
 */
export function placeCitations(body: string, supports: CitationSupport[], sourceCount: number): CitationPlacement {
  const flat = normalize(body);
  const sourcesAt = new Map<number, number[]>();
  let unplaced = 0;

  for (const support of supports) {
    const indices = validIndices(support.sourceIndices, sourceCount);
    const needle = normalize(support.text).text.trim();
    const start = indices.length > 0 && needle.length > 0 ? flat.text.indexOf(needle) : -1;
    if (start < 0) {
      unplaced++;
      continue;
    }
    // Insert after the segment's last character, and past any emphasis markers that close it.
    let at = flat.origin[start + needle.length - 1] + 1;
    while (at < body.length && isEmphasis(body.charAt(at))) at++;

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

  return { markdown, refs, unplaced };
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
