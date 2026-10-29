import { DRUG_DB } from '@/data/drug-database';

/**
 * Build a regex (and reverse map) that detects any drug name from DRUG_DB
 * inside the brief text. Sorted by length DESC so "Piperacillin/Tazobactam"
 * matches before "Piperacillin" alone. Word-boundary anchored so we don't
 * grab substrings inside other words.
 */
export type DrugMatcher = { regex: RegExp; lookup: Map<string, string> };
export function buildDrugMatcher(): DrugMatcher {
  const entries: Array<{ pattern: string; key: string }> = [];
  for (const d of DRUG_DB) {
    const candidates = [d.genericName, d.brandName].filter(Boolean) as string[];
    for (const name of candidates) {
      // Skip very short names (≤3 chars) to avoid noise like "PD" matching prose
      if (name.length < 4) continue;
      entries.push({ pattern: name, key: d.genericName.toLowerCase() });
    }
  }
  entries.sort((a, b) => b.pattern.length - a.pattern.length);
  const lookup = new Map<string, string>();
  for (const e of entries) lookup.set(e.pattern.toLowerCase(), e.key);
  // Build alternation, escaping regex metacharacters; "/" needs no escape inside class.
  const escaped = entries.map(e => e.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // \b doesn't work next to "/", so use a custom boundary that allows "/" or "-"
  // Use lookbehind/lookahead for non-letter characters.
  const regex = new RegExp(`(?<![A-Za-z])(${escaped.join('|')})(?![A-Za-z])`, 'gi');
  return { regex, lookup };
}

/**
 * Replace drug names in markdown text with `[Name](#drug:<key>)` so the link
 * renderer turns them into clickable chips. Skips replacements inside fenced
 * code blocks, inline code, and existing markdown links to avoid breaking
 * citation links or formatted code.
 */
export function injectDrugLinks(text: string, matcher: DrugMatcher): string {
  if (!text) return text;
  // Split out segments we should NOT touch (fenced code, inline code, links).
  const segments: Array<{ kind: 'safe' | 'skip'; content: string }> = [];
  const skipRegex = /(```[\s\S]*?```|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = skipRegex.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'safe', content: text.slice(last, m.index) });
    segments.push({ kind: 'skip', content: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'safe', content: text.slice(last) });

  return segments
    .map(seg => {
      if (seg.kind === 'skip') return seg.content;
      // For each safe segment, replace each drug-name match ONCE per segment to
      // avoid pelting every occurrence of "vancomycin" with a chip — keeps the
      // brief readable. Track replaced keys per-segment.
      const seen = new Set<string>();
      return seg.content.replace(matcher.regex, (match) => {
        const key = matcher.lookup.get(match.toLowerCase());
        if (!key || seen.has(key)) return match;
        seen.add(key);
        return `[${match}](#drug:${key})`;
      });
    })
    .join('');
}

// ── Markdown repair (run before react-markdown) ────────────────────
// The model sometimes emits:
//   • Bare section LABELS ("Recommended Regimen", "Monitoring Parameters",
//     "Baseline & Ongoing Monitoring:") as plain lines instead of "###" headings
//     — so they render flush against the surrounding paragraphs with no break.
//   • Bold lead-in items ("**Induction:**", "**Maintenance:**", ...) on
//     consecutive lines without a blank line between them — markdown
//     collapses them into one paragraph joined by <br>, so the prose
//     paragraph margins (my-5) never get applied between them.
//
// Repair both before render so the brief reads with proper section rhythm.
export function repairBriefMarkdown(raw: string): string {
  let out = raw;

  // 1) Promote bare Title-Case section labels (≤7 words, optionally with a
  //    trailing colon) to ### headings. Stays conservative: skips lines that
  //    already start with #, *, -, |, a digit, or look like a sentence (too
  //    many words / mid-line periods).
  out = out.replace(
    /^(?!#|\*|-|\||>|\d+\.)([A-Z][A-Za-z0-9 &/()\-]{1,60})(:?)\s*$/gm,
    (line, label: string) => {
      const trimmed = label.trim();
      const words = trimmed.split(/\s+/);
      if (words.length > 7) return line;          // too long for a label
      if (/[a-z][.!?]/.test(trimmed)) return line; // looks like a sentence
      // Must contain at least one Title-Cased multi-letter word beyond the
      // first to avoid promoting random short fragments.
      const titleish = words.filter(w => /^[A-Z][a-z]/.test(w)).length;
      if (titleish < 1) return line;
      return `### ${trimmed}`;
    },
  );

  // 2) Insert a blank line between two adjacent bold-lead paragraphs so each
  //    becomes its own <p>. Pattern: a line that starts with **...** followed
  //    by EXACTLY one newline followed by another line starting with **...**.
  //    Re-run until no more matches because each replacement only consumes one
  //    boundary at a time.
  const boldLeadJoin = /^(\*\*[^*\n]+\*\*[^\n]*)\n(\*\*[^*\n]+\*\*)/gm;
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(boldLeadJoin, '$1\n\n$2');
  }

  // 3) Ensure a blank line BEFORE any heading that isn't already preceded by one.
  out = out.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');

  return out;
}
