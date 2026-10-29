# Infusion Copilot Q&A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Infusion Copilot tab as a conversational Q&A with sentence-level citation chips, verified rich references, a source-mix badge, Quick/Thorough depth, and browser-saved threads.

**Architecture:** Pure logic lives in `lib/copilot/` (follow-ups, source typing, citation placement, thread state/storage, request building, turn runner) and is unit-tested with Vitest. The answer stream gains an additive `supports` event built from Gemini's `groundingSupports`; a separate `/api/sources/resolve` route resolves Gemini redirect links (allowlisted) and enriches PubMed/PMC sources from NCBI. React components in `components/copilot/` render a thread; `InfusionConsult` becomes a thin container.

**Tech Stack:** Next.js 15.5 (App Router), React 19, TypeScript strict, Tailwind 4, lucide-react 0.553, `@google/genai` 1.52, Vitest (new dev dependency).

**Spec:** `docs/superpowers/specs/2026-10-28-infusion-copilot-qa-design.md`

## Global Constraints

- Work on branch `copilot-qa`; commit after every task; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No OpenEvidence identity in code or copy: never use "OpenEvidence", "EvidenceGrade", "Osler", "Sackett", "Snow". No HIPAA claim anywhere.
- Theme: use the app's remapped classes (`text-white`, `text-slate-*`, `text-blue-*`/`text-emerald-*`/`text-violet-*`, `bg-white/5`, `border-white/10`, `glass-panel`). `amber`/`rose` are reserved for safety signals. Every screen must work in dark and light themes.
- Answer prose uses Source Serif 4 (`--font-serif`); everything else keeps existing fonts.
- localStorage key `switchrx.copilot.threads.v1`, payload `{ version: 1, threads }`, cap 50 threads (most recently updated kept).
- Pharmacy lookup cap 12 000 ms. Source resolution: 4 000 ms per link, 10 000 ms overall, ≤ 40 URIs per request.
- Allowed redirect host: exactly `vertexaisearch.cloud.google.com` over `https:`. Never fetch a resolved destination page. NCBI calls carry `tool=switchrx`.
- Conversation history sent to the model: last 6 turns with status `done` or `stopped` and a non-empty answer.
- "Recent" tag: `year >= now.getFullYear() - 2`.
- Other `streamAI` consumers (`ClinicalChat`, `GuidelineSummarizer`, `IDSAAntibioticAdvisor`) must keep working unchanged; `thinkingLevel` defaults to `'high'`.
- Lint: no new ESLint errors in new or changed files (`npx eslint <files>`).
- UI copy (exact): title "Infusion Copilot"; subtitle "Ask any infusion question. Answers cite their sources."; trust line "Verified FDA label & shortage check on every question"; notice "Saved on this device · avoid patient identifiers"; shortcuts "Dose & renal adjustment", "Preparation & stability", "Infusion reactions"; "Explore example questions"; depth "Quick" ("Fast answers to simple questions") / "Thorough" ("Careful answers for complex cases"); placeholders "Ask an infusion question…" (home) / "Ask a follow-up…" (docked); "History"; "Clear all history"; "New question"; "Saved in this browser only"; "History can't be saved in this browser"; steps "Identified drugs", "Checked FDA labels, shortages & safety lists", "Searched literature & guidelines", "Done"; "FDA lookup unavailable"; "References"; "Sources searched" with note "These sources couldn't be tied to specific sentences."; "Suggested follow-ups"; "Copy answer" → "Copied"; "Stop"; "Stopped"; "Retry"; "Play while you wait"; "See all references".

## Review Focus

1. **A new question, thread switch, or thread delete while an answer is still generating** — the running answer must be stopped and must never write into another thread. Pinned by Task 4 (`patchTurn` on a missing thread/turn is a no-op) and Task 13 (controller aborted on switch).
2. **Gemini support indices outside the chunk list, or chunks that collapse to one source after de-duplication** — skipped or merged, never a crash or a wrong source. Pinned by Task 5.
3. **An answer that ends with an unclosed or malformed follow-up block** — the answer still displays and items are recovered when possible. Pinned by Task 1.
4. **NCBI rate-limits (HTTP 429), has no record, or times out** — that reference falls back to title + site while other sources still enrich. Pinned by Tasks 7 and 8.
5. **The same sentence appears twice, or Gemini's segment text lacks the answer's bold markers** — one chip at the first occurrence, emphasis does not block matching. Pinned by Task 3.

---

### Task 1: Vitest setup and follow-up block parsing

**Files:**
- Modify: `package.json` (add `vitest` devDependency, script `"test": "vitest run"`)
- Create: `vitest.config.ts`
- Create: `lib/copilot/followups.ts`
- Test: `lib/copilot/followups.test.ts`

**Interfaces:**
- Produces: `splitFollowUps(text: string, final?: boolean): { body: string; followUps: string[]; pending: boolean }`

- [ ] **Step 1: Install Vitest and configure it**

Run: `npm install --save-dev vitest`. Create `vitest.config.ts` with `resolve.alias` `'@'` → project root (`path.resolve(__dirname, '.')`), `test.environment: 'node'`, `test.include: ['**/*.test.ts']`, `test.exclude: ['node_modules/**', '.next/**']`. Add `"test": "vitest run"` to `scripts`.

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { splitFollowUps } from './followups';

const FULL = 'Answer text.\n\n```followups\n- How long is the infusion?\n- What premeds?\n- Is a filter needed?\n```';

describe('splitFollowUps', () => {
  it('extracts a complete block and strips it from the body', () => {
    expect(splitFollowUps(FULL)).toEqual({
      body: 'Answer text.',
      followUps: ['How long is the infusion?', 'What premeds?', 'Is a filter needed?'],
      pending: false,
    });
  });
  it('hides an open block while streaming', () => {
    expect(splitFollowUps('Answer text.\n\n```followups\n- How long')).toEqual({ body: 'Answer text.', followUps: [], pending: true });
  });
  it('hides a partially typed opening fence while streaming', () => {
    expect(splitFollowUps('Answer text.\n\n```follo')).toEqual({ body: 'Answer text.', followUps: [], pending: true });
  });
  it('returns the text unchanged when there is no block', () => {
    expect(splitFollowUps('Just an answer.')).toEqual({ body: 'Just an answer.', followUps: [], pending: false });
  });
  it('recovers items from an unclosed block when final', () => {
    expect(splitFollowUps('A.\n```followups\n- One?\n* Two?\n1. Three?', true)).toEqual({ body: 'A.', followUps: ['One?', 'Two?', 'Three?'], pending: false });
  });
  it('keeps at most three non-empty items', () => {
    const r = splitFollowUps('A.\n```followups\n- 1?\n-\n- 2?\n- 3?\n- 4?\n```');
    expect(r.followUps).toEqual(['1?', '2?', '3?']);
  });
  it('does not treat an ordinary code fence as a follow-up block', () => {
    const t = 'Use:\n```\nrate = dose / time\n```\nDone.';
    expect(splitFollowUps(t, true)).toEqual({ body: t, followUps: [], pending: false });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run lib/copilot/followups.test.ts` — Expected: FAIL (cannot find module `./followups`).

- [ ] **Step 4: Implement `splitFollowUps`**

Find the last line equal to ` ```followups ` (after trim). If found: body = text before it (trimEnd); items = following lines up to a closing ` ``` ` line (or end of text), each stripped of a leading `-`, `*`, or `\d+.` marker and trimmed, empties dropped, first 3 kept; `pending = !closed && !final`, and when pending, `followUps = []`. If not found and `!final`: if the text's trailing line is a non-empty prefix of ` ```followups ` (≥ 3 chars), strip it and set `pending: true`.

- [ ] **Step 5: Run tests** — `npx vitest run lib/copilot/followups.test.ts` — Expected: 7 passed.

- [ ] **Step 6: Commit** — `git add package.json package-lock.json vitest.config.ts lib/copilot/followups.ts lib/copilot/followups.test.ts && git commit -m "Add Vitest and Copilot follow-up block parsing"`

---

### Task 2: Shared types, source typing, source-mix badge, FDA label titles

**Files:**
- Create: `lib/copilot/types.ts`, `lib/copilot/source-types.ts`, `lib/copilot/label-titles.ts`
- Test: `lib/copilot/source-types.test.ts`, `lib/copilot/label-titles.test.ts`

**Interfaces:**
- Consumes: `GroundingSource` from `@/lib/ai`; `LookupResult` from `@/lib/pharmacy-lookup`; `DRUG_DB` from `@/data/drug-database`.
- Produces (in `types.ts`, exactly as spec §6.2/§6.3 plus `lookupState`):
  - `type Depth = 'quick' | 'thorough'`
  - `type SourceType = 'fda-label' | 'guideline' | 'systematic-review' | 'trial' | 'journal' | 'agency' | 'web'`
  - `interface EnrichedSource { uri; url: string | null; site; title; shortName; journal?; year?: number; authors?; pmid?; type: SourceType }`
  - `type TurnStatus = 'lookup' | 'streaming' | 'resolving' | 'done' | 'stopped' | 'error'`
  - `type LookupState = 'pending' | 'ok' | 'failed' | 'timeout'`
  - `interface CopilotTurn { id; question; depth: Depth; askedAt: number; status: TurnStatus; answer: string; followUps: string[]; supports: CitationSupport[]; sources: EnrichedSource[]; lookup: LookupResult | null; lookupState: LookupState; firstTokenAt?: number; error?: string }`
  - `type TurnPatch = Partial<Omit<CopilotTurn, 'id' | 'question' | 'depth' | 'askedAt'>>`
  - `interface CopilotThread { id; title; createdAt: number; updatedAt: number; turns: CopilotTurn[] }`
  - (`CitationSupport` is defined in Task 5 in `@/lib/ai`; create it here first as `export type CitationSupport = { text: string; sourceIndices: number[] }` in `lib/ai.ts` so this task compiles.)
- Produces (in `source-types.ts`): `classifySource(input: { host: string; pubtypes?: string[] }): SourceType`; `siteShortName(host: string): string`; `fallbackSource(src: GroundingSource): EnrichedSource`; `sourceMix(sources: EnrichedSource[]): { groups: { type: SourceType; count: number; label: string; sourceIndices: number[] }[]; text: string }`; `isRecent(year: number | undefined, now: Date): boolean`; `TYPE_LABEL: Record<SourceType, string>` = `{ 'fda-label': 'FDA label', guideline: 'Guideline', 'systematic-review': 'Systematic review', trial: 'Trial', journal: 'Journal', agency: 'Agency', web: 'Web' }`.
- Produces (in `label-titles.ts`): `titleFdaLabels(sources: EnrichedSource[], lookup: LookupResult | null): EnrichedSource[]`.

Host rules (match `host === d || host.endsWith('.' + d)`), evaluated in this order:
1. FDA: `dailymed.nlm.nih.gov`, `fda.gov` → `fda-label`.
2. pubtypes contains "Practice Guideline" or "Guideline", or society host (`idsociety.org`, `ashp.org`, `nccn.org`, `ins1.org`, `ons.org`, `asco.org`, `hematology.org`, `rheumatology.org`) → `guideline`.
3. pubtypes contains "Systematic Review" or "Meta-Analysis", or host `cochranelibrary.com` → `systematic-review`.
4. pubtypes contains "Randomized Controlled Trial" or starts with "Clinical Trial" → `trial`.
5. Journal host (`ncbi.nlm.nih.gov`, `nejm.org`, `jamanetwork.com`, `thelancet.com`, `academic.oup.com`, `bmj.com`, `nature.com`, `sciencedirect.com`, `springer.com`, `wiley.com`, `ahajournals.org`, `ashpublications.org`, `ascopubs.org`, `asm.org`) or any pubtypes present → `journal`.
6. Agency host (`cdc.gov`, `nih.gov`, `who.int`, `cms.gov`) → `agency`.
7. Otherwise `web`.

`siteShortName`: FDA hosts → "FDA label"; idsociety.org "IDSA"; ashp.org "ASHP"; nccn.org "NCCN"; ins1.org "INS"; ons.org "ONS"; asco.org "ASCO"; hematology.org "ASH"; rheumatology.org "ACR"; cochranelibrary.com "Cochrane"; `ncbi.nlm.nih.gov` subdomains "PubMed"; cdc.gov "CDC"; nih.gov "NIH"; who.int "WHO"; cms.gov "CMS"; `''` → "Web"; otherwise the host without a leading `www.`.

`sourceMix` label: `${count} ${singular|plural}` with singular/plural FDA label/FDA labels, guideline/guidelines, systematic review/systematic reviews, trial/trials, article/articles (journal), agency source/agency sources, web source/web sources; groups in the tier order above; `text` = first three group labels joined with ` · `. (This regularizes the spec's example to "1 FDA label · 2 guidelines · 1 trial".)

- [ ] **Step 1: Write the failing tests**

```ts
// source-types.test.ts
const V = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc';
it.each([
  [{ host: 'dailymed.nlm.nih.gov' }, 'fda-label'],
  [{ host: 'www.accessdata.fda.gov' }, 'fda-label'],
  [{ host: 'pubmed.ncbi.nlm.nih.gov', pubtypes: ['Journal Article', 'Randomized Controlled Trial'] }, 'trial'],
  [{ host: 'pubmed.ncbi.nlm.nih.gov', pubtypes: ['Practice Guideline'] }, 'guideline'],
  [{ host: 'pubmed.ncbi.nlm.nih.gov', pubtypes: ['Meta-Analysis'] }, 'systematic-review'],
  [{ host: 'www.idsociety.org' }, 'guideline'],
  [{ host: 'www.cochranelibrary.com' }, 'systematic-review'],
  [{ host: 'pubmed.ncbi.nlm.nih.gov' }, 'journal'],
  [{ host: 'pmc.ncbi.nlm.nih.gov' }, 'journal'],
  [{ host: 'www.nejm.org' }, 'journal'],
  [{ host: 'www.cdc.gov' }, 'agency'],
  [{ host: 'example.com' }, 'web'],
])('classifySource(%o) → %s', (input, type) => expect(classifySource(input)).toBe(type));

it('builds a fallback from a domain-style grounding title', () => {
  expect(fallbackSource({ uri: V, title: 'idsociety.org' })).toEqual({
    uri: V, url: null, site: 'idsociety.org', title: 'idsociety.org', shortName: 'IDSA', type: 'guideline',
  });
});
it('builds a web fallback when the title is not a domain', () => {
  expect(fallbackSource({ uri: V, title: 'Some page title' })).toMatchObject({ site: 'web', shortName: 'Web', type: 'web', url: null });
});
it('summarizes cited sources in tier order', () => {
  const s = (type: SourceType) => ({ ...fallbackSource({ uri: V, title: 'x.org' }), type });
  const mix = sourceMix([s('trial'), s('guideline'), s('fda-label'), s('guideline')]);
  expect(mix.text).toBe('1 FDA label · 2 guidelines · 1 trial');
  expect(mix.groups.map(g => [g.type, g.sourceIndices])).toEqual([['fda-label', [2]], ['guideline', [1, 3]], ['trial', [0]]]);
});
it('shows only the first three groups in the text', () => {
  const s = (type: SourceType) => ({ ...fallbackSource({ uri: V, title: 'x.org' }), type });
  const mix = sourceMix([s('web'), s('journal'), s('trial'), s('guideline')]);
  expect(mix.text).toBe('1 guideline · 1 trial · 1 article');
  expect(mix.groups).toHaveLength(4);
});
it('returns an empty mix for no sources', () => expect(sourceMix([])).toEqual({ groups: [], text: '' }));
it('marks sources from the last two years as recent', () => {
  const now = new Date('2026-10-28');
  expect([2026, 2024, 2023, undefined].map(y => isRecent(y, now))).toEqual([true, true, false, false]);
});

// label-titles.test.ts
const label = { ...fallbackSource({ uri: V, title: 'DailyMed - INFLIXIMAB injection' }), type: 'fda-label' as const };
const lookup = { classification: { drug_names: ['infliximab'], query_domain: 'iv_drug_info', urgency: 'routine' },
  drug_lookups: [{ generic_name: 'infliximab', label_sections: [] }], safety_flags: [], data_sources_used: [] } as LookupResult;
it('titles an FDA label that names a looked-up drug', () => {
  expect(titleFdaLabels([label], lookup)[0].title).toBe('Remicade (Infliximab) prescribing information');
});
it('leaves non-label sources, unmatched labels, and a null lookup unchanged', () => {
  const web = fallbackSource({ uri: V, title: 'DailyMed - INFLIXIMAB' });
  const other = { ...label, title: 'DailyMed - VANCOMYCIN' };
  expect(titleFdaLabels([web, other], lookup)).toEqual([web, other]);
  expect(titleFdaLabels([label], null)).toEqual([label]);
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/copilot/source-types.test.ts lib/copilot/label-titles.test.ts` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** the three files per the Interfaces block. `fallbackSource`: if the trimmed title matches `/^[a-z0-9.-]+\.[a-z]{2,}$/i`, host = title (lowercased, `www.` stripped for `site`); else host = the uri's host unless it is `vertexaisearch.cloud.google.com`, else `''`; `site = host || 'web'`; `type = classifySource({ host })`. `titleFdaLabels`: match a lookup `generic_name` (case-insensitive) inside `title + ' ' + (url ?? '')`; brand from `DRUG_DB` by generic name; title `"<Brand> (<Generic>) prescribing information"` or `"<Generic> prescribing information"` without a brand; Generic title-cased.

- [ ] **Step 4: Run tests** — Expected: all pass.

- [ ] **Step 5: Commit** — `git commit -m "Add Copilot source typing, source-mix badge, and FDA label titles"` (with the new files and `lib/ai.ts`).

---

### Task 3: Citation placement, chip labels, copy text

**Files:**
- Create: `lib/copilot/citations.ts`
- Test: `lib/copilot/citations.test.ts`

**Interfaces:**
- Consumes: `CitationSupport`, `EnrichedSource`.
- Produces:
  - `interface CitationPlacement { markdown: string; refs: number[]; unplaced: number }` — `refs[n - 1]` is the source index for reference `n`.
  - `placeCitations(body: string, supports: CitationSupport[], sourceCount: number): CitationPlacement` — inserts ` [cite](#cite:<refNums comma-separated>)` immediately after each matched segment.
  - `parseCiteHref(href: string): number[] | null` — `'#cite:1,2'` → `[1, 2]`.
  - `chipLabel(refNums: number[], refs: number[], sources: EnrichedSource[]): string`
  - `toPlainText(markdown: string, refs: number[], sources: EnrichedSource[]): string`

Matching algorithm (not determined by the tests alone): build a normalized copy of `body` with `*` and `_` removed and whitespace runs collapsed to one space, keeping a map from each normalized index to its original index; normalize the segment text the same way; find the first occurrence; map the match end back to the original index, then advance past any immediately following `*`/`_` characters. Skip supports whose valid source indices (`0 <= i < sourceCount`) are empty or whose text is not found (count them in `unplaced`). A repeated identical segment text is placed only at its first occurrence. Merge supports that end at the same original index (union of source indices in first-seen order). Number references by first appearance scanning insertion points left to right.

- [ ] **Step 1: Write the failing tests**

```ts
const body = 'Infuse over **2 hours**. Use a 1.2 µm filter. Monitor vitals.';
it('places chips after supported sentences, numbering references by first appearance', () => {
  const p = placeCitations(body, [
    { text: 'Use a 1.2 µm filter.', sourceIndices: [2] },
    { text: 'Infuse over 2 hours.', sourceIndices: [0] },
  ], 3);
  expect(p).toEqual({
    markdown: 'Infuse over **2 hours**. [cite](#cite:1) Use a 1.2 µm filter. [cite](#cite:2) Monitor vitals.',
    refs: [0, 2], unplaced: 0,
  });
});
it('puts several sources on one chip', () => {
  expect(placeCitations('A fact.', [{ text: 'A fact.', sourceIndices: [1, 0] }], 2).markdown).toBe('A fact. [cite](#cite:1,2)');
});
it('merges supports that end at the same place', () => {
  const p = placeCitations('Use a filter.', [{ text: 'Use a filter.', sourceIndices: [0] }, { text: 'a filter.', sourceIndices: [1] }], 2);
  expect(p.markdown).toBe('Use a filter. [cite](#cite:1,2)');
});
it('places a repeated sentence only at its first occurrence', () => {
  expect(placeCitations('Dose daily. Dose daily.', [{ text: 'Dose daily.', sourceIndices: [0] }], 1).markdown)
    .toBe('Dose daily. [cite](#cite:1) Dose daily.');
});
it('drops supports that are not in the answer and keeps their sources out of refs', () => {
  const p = placeCitations('Only this.', [{ text: 'Not present.', sourceIndices: [0] }, { text: 'Only this.', sourceIndices: [1] }], 2);
  expect(p).toEqual({ markdown: 'Only this. [cite](#cite:1)', refs: [1], unplaced: 1 });
});
it('ignores source indices outside the source list', () => {
  expect(placeCitations('X.', [{ text: 'X.', sourceIndices: [5] }], 2)).toEqual({ markdown: 'X.', refs: [], unplaced: 1 });
});
it('matches across differing whitespace', () => {
  expect(placeCitations('Line one\ncontinues.', [{ text: 'Line one continues.', sourceIndices: [0] }], 1).markdown)
    .toBe('Line one\ncontinues. [cite](#cite:1)');
});
it('parses chip hrefs', () => expect(parseCiteHref('#cite:1,2')).toEqual([1, 2]));
it('labels a chip with the first source and a count', () => {
  const a = { ...fallbackSource({ uri: 'u', title: 'x.org' }), shortName: 'N Engl J Med' };
  const b = { ...a, shortName: 'FDA label' };
  expect(chipLabel([1, 2], [0, 1], [a, b])).toBe('N Engl J Med + 1');
  expect(chipLabel([2], [0, 1], [a, b])).toBe('FDA label');
});
it('formats an answer with numbered references for copying', () => {
  const s = { uri: 'u', url: 'https://pubmed.ncbi.nlm.nih.gov/16914701/', site: 'pubmed.ncbi.nlm.nih.gov', title: 'Daptomycin trial.',
    shortName: 'N Engl J Med', journal: 'The New England journal of medicine', year: 2006, type: 'trial' as const };
  expect(toPlainText('Fact. [cite](#cite:1)', [0], [s]))
    .toBe('Fact. [1]\n\nReferences\n1. Daptomycin trial. — The New England journal of medicine, 2006. https://pubmed.ncbi.nlm.nih.gov/16914701/');
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/copilot/citations.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** per the algorithm and Interfaces. `toPlainText` replaces each `[cite](#cite:1,2)` with `[1, 2]`; each reference line is `${n}. ${title} — ${journal ?? site}${year ? ', ' + year : ''}.${url ? ' ' + url : ''}`.
- [ ] **Step 4: Run tests** — Expected: all pass.
- [ ] **Step 5: Commit** — `git commit -m "Add sentence-level citation placement for the Copilot"`

---

### Task 4: Thread state reducer and browser storage

**Files:**
- Create: `lib/copilot/state.ts`, `lib/copilot/threads.ts`
- Test: `lib/copilot/state.test.ts`, `lib/copilot/threads.test.ts`

**Interfaces:**
- Consumes: `CopilotThread`, `CopilotTurn`, `TurnPatch`.
- Produces (`state.ts`):
  - `interface CopilotState { threads: CopilotThread[]; activeThreadId: string | null }`
  - `type CopilotAction = { type: 'load'; threads: CopilotThread[] } | { type: 'newThread' } | { type: 'openThread'; threadId: string } | { type: 'startTurn'; threadId: string | null; newThreadId: string; turn: CopilotTurn; now: number } | { type: 'patchTurn'; threadId: string; turnId: string; patch: TurnPatch; now: number } | { type: 'deleteThread'; threadId: string } | { type: 'clearAll' }`
  - `copilotReducer(state: CopilotState, action: CopilotAction): CopilotState`
- Produces (`threads.ts`):
  - `type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `THREADS_KEY = 'switchrx.copilot.threads.v1'`, `MAX_THREADS = 50`
  - `loadThreads(storage: StorageLike | null): CopilotThread[]`
  - `saveThreads(storage: StorageLike | null, threads: CopilotThread[]): 'ok' | 'unavailable'`

- [ ] **Step 1: Write the failing tests**

```ts
// state.test.ts
const turn = (id: string, q = 'Vanco rate?'): CopilotTurn => ({ id, question: q, depth: 'thorough', askedAt: 1, status: 'streaming',
  answer: '', followUps: [], supports: [], sources: [], lookup: null, lookupState: 'pending' });
const empty: CopilotState = { threads: [], activeThreadId: null };
it('starts a new thread titled with the question (≤ 80 chars) and opens it', () => {
  const s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a', 'x'.repeat(100)), now: 5 });
  expect(s.activeThreadId).toBe('t1');
  expect(s.threads[0]).toMatchObject({ id: 't1', title: 'x'.repeat(80), createdAt: 5, updatedAt: 5 });
});
it('appends a turn to an existing thread', () => { /* startTurn twice with threadId 't1' → turns ['a','b'] */ });
it('patches a turn and bumps updatedAt', () => { /* patchTurn status 'done', now 9 → turn.status 'done', thread.updatedAt 9 */ });
it('ignores patches for a missing thread or turn', () => {
  const s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a'), now: 1 });
  expect(copilotReducer(s, { type: 'patchTurn', threadId: 'gone', turnId: 'a', patch: { answer: 'x' }, now: 2 })).toBe(s);
  expect(copilotReducer(s, { type: 'patchTurn', threadId: 't1', turnId: 'gone', patch: { answer: 'x' }, now: 2 })).toBe(s);
});
it('returns home after deleting the active thread', () => { /* activeThreadId null, thread removed */ });
it('clears all threads and returns home', () => { /* clearAll → empty */ });
it('opens a thread and starts a new question', () => { /* openThread sets id; newThread sets null */ });

// threads.test.ts — MemoryStorage implements StorageLike with a Map; `failing` variant throws on setItem
it('round-trips completed turns under the v1 key', () => {
  const m = new MemoryStorage();
  expect(saveThreads(m, [thread('t1', [done('a')])])).toBe('ok');
  expect(JSON.parse(m.getItem('switchrx.copilot.threads.v1')!).version).toBe(1);
  expect(loadThreads(m)).toEqual([thread('t1', [done('a')])]);
});
it('does not persist running turns and drops threads left empty', () => { /* turns with status lookup/streaming/resolving omitted */ });
it('keeps only the 50 most recently updated threads', () => { /* save 55 → load 50, highest updatedAt kept */ });
it('returns [] for corrupt JSON, a wrong version, or non-array threads', () => { /* three cases */ });
it('reports unavailable when storage is missing or setItem throws', () => {
  expect(saveThreads(null, [])).toBe('unavailable');
  expect(saveThreads(new FailingStorage(), [thread('t1', [done('a')])])).toBe('unavailable');
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement** both modules. `patchTurn` returns the same `state` object when the thread or turn is missing. `deleteThread` sets `activeThreadId` to `null` when it removes the active thread. `loadThreads` never throws.
- [ ] **Step 4: Run tests** — Expected: all pass.
- [ ] **Step 5: Commit** — `git commit -m "Add Copilot thread state reducer and browser storage"`

---

### Task 5: Citation supports in the answer stream

**Files:**
- Create: `lib/grounding.ts` (no `server-only` import, so it is testable)
- Modify: `lib/ai-server.ts` (use `lib/grounding.ts`; accept `thinkingLevel`; emit `supports`)
- Modify: `app/api/ai/stream/route.ts` (pass `thinkingLevel`)
- Modify: `lib/ai.ts` (`CitationSupport` already added in Task 2; add `thinkingLevel` option, `onSupports` callback, return `supports`)
- Test: `lib/grounding.test.ts`, `lib/ai.test.ts`

**Interfaces:**
- Produces (`lib/grounding.ts`):
  - `class SourceCollector { add(uri?: string | null, title?: string | null): number /* index, or -1 if no uri */; changed(): boolean; list(): GroundingSource[] }` — moved from `ai-server.ts`; key `${uri}::${title.toLowerCase()}`.
  - `mapSupports(metadata: { groundingChunks?: { web?: { uri?: string; title?: string } }[]; groundingSupports?: { segment?: { text?: string }; groundingChunkIndices?: number[] }[] }, collector: SourceCollector): CitationSupport[]`
  - `class SupportCollector { add(supports: CitationSupport[]): boolean /* changed */; list(): CitationSupport[] }` — de-duplicates by `text`.
- Produces (`lib/ai-server.ts`): `StreamEvent` gains `{ type: 'supports'; supports: CitationSupport[] }`; `runAIStream` opts gain `thinkingLevel?: 'low' | 'high'` (`'low'` → `ThinkingLevel.LOW`, otherwise `ThinkingLevel.HIGH`).
- Produces (`lib/ai.ts`): `streamAI` opts gain `thinkingLevel?: 'low' | 'high'` (sent in the body only when provided) and `cb.onSupports?: (supports: CitationSupport[]) => void`; return type gains `supports: CitationSupport[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// grounding.test.ts
it('returns stable indices for duplicate sources', () => {
  const c = new SourceCollector();
  expect([c.add('u1', 'A'), c.add('u2', 'B'), c.add('u1', 'a')]).toEqual([0, 1, 0]);
});
it('translates chunk indices through the metadata chunk list to collector positions', () => {
  const c = new SourceCollector(); c.add('uA', 'A');
  const supports = mapSupports({
    groundingChunks: [{ web: { uri: 'uB', title: 'B' } }, { web: { uri: 'uA', title: 'A' } }],
    groundingSupports: [{ segment: { text: 'Claim.' }, groundingChunkIndices: [0, 1] }],
  }, c);
  expect(supports).toEqual([{ text: 'Claim.', sourceIndices: [1, 0] }]);
});
it('skips out-of-range chunk indices and supports without text', () => {
  const c = new SourceCollector();
  expect(mapSupports({
    groundingChunks: [{ web: { uri: 'uA', title: 'A' } }],
    groundingSupports: [{ segment: { text: 'Ok.' }, groundingChunkIndices: [0, 7] }, { segment: {}, groundingChunkIndices: [0] }, { segment: { text: 'None.' }, groundingChunkIndices: [9] }],
  }, c)).toEqual([{ text: 'Ok.', sourceIndices: [0] }]);
});
it('collapses chunks that de-duplicate to one source', () => {
  const c = new SourceCollector();
  expect(mapSupports({
    groundingChunks: [{ web: { uri: 'uA', title: 'A' } }, { web: { uri: 'uA', title: 'a' } }],
    groundingSupports: [{ segment: { text: 'X.' }, groundingChunkIndices: [0, 1] }],
  }, c)).toEqual([{ text: 'X.', sourceIndices: [0] }]);
});
it('accumulates supports across chunks, de-duplicated by text', () => {
  const s = new SupportCollector();
  expect(s.add([{ text: 'A.', sourceIndices: [0] }])).toBe(true);
  expect(s.add([{ text: 'A.', sourceIndices: [0] }])).toBe(false);
  expect(s.list()).toHaveLength(1);
});

// ai.test.ts — stub global fetch with a Response whose body streams NDJSON lines
it('forwards supports events and sends thinkingLevel only when given', async () => {
  // lines: text, sources, supports, done → onSupports called with the supports; result.supports equals them;
  // request body JSON has thinkingLevel 'low' when passed, and no thinkingLevel key when omitted.
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/grounding.test.ts lib/ai.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/grounding.ts`; refactor `runAIStream` to use it: for each streamed chunk's `groundingMetadata`, add chunks to the `SourceCollector` (as today), then `mapSupports` → `SupportCollector.add`; when changed, emit `{ type: 'supports', supports: collector.list() }`; flush after the loop like `sources`. Pass `thinkingLevel` through the route and `streamAI`.
- [ ] **Step 4: Run tests and typecheck** — `npx vitest run` then `npx tsc --noEmit` — Expected: all pass, no type errors (other `streamAI` callers compile unchanged).
- [ ] **Step 5: Commit** — `git commit -m "Stream Gemini citation supports and accept a thinking level"`

---

### Task 6: Allowlisted redirect resolver (SSRF guard)

**Files:**
- Create: `lib/source-metadata/resolve-redirect.ts`
- Test: `lib/source-metadata/resolve-redirect.test.ts`

**Interfaces:**
- Produces:
  - `GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com'`
  - `type FetchLike = (input: string, init?: RequestInit) => Promise<Response>`
  - `isAllowedGroundingUri(uri: string): boolean`
  - `resolveRedirect(uri: string, fetchImpl: FetchLike, timeoutMs?: number /* default 4000 */): Promise<string | null>`

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ['https://vertexaisearch.cloud.google.com/grounding-api-redirect/x', true],
  ['http://vertexaisearch.cloud.google.com/grounding-api-redirect/x', false],
  ['https://evil.example/x', false],
  ['https://vertexaisearch.cloud.google.com.evil.com/x', false],
  ['not a url', false],
])('isAllowedGroundingUri(%s) → %s', (u, ok) => expect(isAllowedGroundingUri(u)).toBe(ok));

const R = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/x';
it('returns the Location of a redirect without following it', async () => {
  const f = vi.fn(async () => new Response(null, { status: 302, headers: { Location: 'https://pubmed.ncbi.nlm.nih.gov/16914701/' } }));
  expect(await resolveRedirect(R, f)).toBe('https://pubmed.ncbi.nlm.nih.gov/16914701/');
  expect(f).toHaveBeenCalledTimes(1);
  expect(f.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
});
it('resolves a relative Location against the request URL', async () => { /* Location '/a/b' → 'https://vertexaisearch.cloud.google.com/a/b' */ });
it('returns null for a non-redirect, a missing Location, or a disallowed URI (no fetch)', async () => { /* 200; 302 without header; 'https://evil.example' with f not called */ });
it('returns null when the timeout elapses', async () => {
  const hang: FetchLike = (_u, init) => new Promise((_r, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted'))));
  expect(await resolveRedirect(R, hang, 20)).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement** using `new URL()` parsing (protocol `https:` and `hostname === GROUNDING_REDIRECT_HOST` exactly), a `GET` with `redirect: 'manual'` and an `AbortController` timeout; accept statuses 301/302/303/307/308; return `new URL(location, uri).toString()`; never throw.
- [ ] **Step 4: Run tests** — Expected: all pass.
- [ ] **Step 5: Commit** — `git commit -m "Add allowlisted grounding redirect resolver"`

---

### Task 7: NCBI client (PubMed summaries, PMC → PMID)

**Files:**
- Create: `lib/source-metadata/ncbi.ts`
- Create: `lib/source-metadata/__fixtures__/esummary-16914701.json` (saved real response)
- Test: `lib/source-metadata/ncbi.test.ts`

**Interfaces:**
- Consumes: `FetchLike` (Task 6).
- Produces:
  - `parseArticleId(url: string): { pmid?: string; pmcid?: string }`
  - `interface PubmedSummary { title: string; journalAbbrev: string; journal: string; year?: number; authors: string; pubtypes: string[] }`
  - `fetchPubmedSummaries(pmids: string[], fetchImpl: FetchLike, signal?: AbortSignal): Promise<Map<string, PubmedSummary>>` — one request: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&tool=switchrx&id=<comma-joined>`
  - `pmcToPmid(pmcids: string[], fetchImpl: FetchLike, signal?: AbortSignal): Promise<Map<string, string>>` — one request: `https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?format=json&tool=switchrx&ids=<comma-joined>`

- [ ] **Step 1: Save the fixture** — `curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&tool=switchrx&id=16914701" > lib/source-metadata/__fixtures__/esummary-16914701.json`

- [ ] **Step 2: Write the failing tests**

```ts
it.each([
  ['https://pubmed.ncbi.nlm.nih.gov/16914701/', { pmid: '16914701' }],
  ['https://www.ncbi.nlm.nih.gov/pubmed/16914701', { pmid: '16914701' }],
  ['https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3036345/', { pmcid: 'PMC3036345' }],
  ['https://pmc.ncbi.nlm.nih.gov/articles/PMC3036345/', { pmcid: 'PMC3036345' }],
  ['https://www.nejm.org/doi/full/10.1056/NEJMoa053783', {}],
])('parseArticleId(%s)', (u, out) => expect(parseArticleId(u)).toEqual(out));

it('parses a saved esummary response', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify(fixture)));
  const m = await fetchPubmedSummaries(['16914701'], f);
  expect(m.get('16914701')).toEqual({
    title: 'Daptomycin versus standard therapy for bacteremia and endocarditis caused by Staphylococcus aureus.',
    journalAbbrev: 'N Engl J Med', journal: 'The New England journal of medicine', year: 2006,
    authors: 'Fowler VG Jr, Boucher HW, Corey GR, et al.',
    pubtypes: expect.arrayContaining(['Randomized Controlled Trial']),
  });
  expect(f.mock.calls[0][0]).toContain('db=pubmed');
  expect(f.mock.calls[0][0]).toContain('tool=switchrx');
});
it('batches several ids into one request', async () => { /* ['1','2'] → one call, url contains 'id=1,2' */ });
it('returns an empty map on HTTP 429 or a network error', async () => { /* status 429; fetch rejects */ });
it('skips uids with an error or no record', async () => { /* result: { uids: ['1'], '1': { error: 'cannot get document summary' } } → empty map */ });
it('maps PMC ids to PMIDs', async () => {
  const f = vi.fn(async () => new Response(JSON.stringify({ records: [{ pmcid: 'PMC3036345', pmid: 21326734 }] })));
  expect(await pmcToPmid(['PMC3036345'], f)).toEqual(new Map([['PMC3036345', '21326734']]));
});
```

- [ ] **Step 3: Run to verify failure** — Expected: FAIL.
- [ ] **Step 4: Implement.** Year = first 4 digits of `pubdate`; authors = first three `authors[].name` joined with `, ` plus `, et al.` when more; never throw (return empty maps).
- [ ] **Step 5: Run tests** — Expected: all pass.
- [ ] **Step 6: Commit** — `git commit -m "Add NCBI PubMed summary and PMC ID lookup"`

---

### Task 8: Source enrichment and `/api/sources/resolve`

**Files:**
- Create: `lib/source-metadata/enrich.ts`
- Create: `app/api/sources/resolve/route.ts`
- Test: `lib/source-metadata/enrich.test.ts`, `app/api/sources/resolve/route.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 6, 7.
- Produces:
  - `interface EnrichDeps { fetchImpl: FetchLike; cache?: Map<string, { value: EnrichedSource; expires: number }>; now?: () => number }`
  - `enrichSources(sources: GroundingSource[], deps: EnrichDeps, opts?: { perLinkTimeoutMs?: number /* 4000 */; totalTimeoutMs?: number /* 10000 */ }): Promise<EnrichedSource[]>` — same length and order as input; cache TTL 24 h; default cache is a module-level `Map`.
  - Route `POST /api/sources/resolve` (`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`): body `{ sources: { uri: string; title: string }[] }` with 1–40 items, else `400`; responds `{ sources: EnrichedSource[] }` using global `fetch`.

Per-source flow: start from `fallbackSource`; if allowed, `resolveRedirect` → `url`, `site` = host without `www.`, `type = classifySource({ host })`, `shortName = siteShortName(host)`; collect PMIDs (and PMCIDs → `pmcToPmid`) across sources, then one `fetchPubmedSummaries`; for a PubMed hit set `title`, `journal`, `shortName = journalAbbrev`, `year`, `authors`, `pmid`, `type = classifySource({ host, pubtypes })`. Resolve at most 6 links concurrently. When the overall budget elapses, return fallbacks for unfinished sources.

- [ ] **Step 1: Write the failing tests**

```ts
// enrich.test.ts — fake fetch routes by URL: grounding URI → 302 to a destination; esummary → fixture
it('enriches a PubMed source end to end', async () => {
  const [s] = await enrichSources([{ uri: R1, title: 'pubmed.ncbi.nlm.nih.gov' }], { fetchImpl, cache: new Map() });
  expect(s).toEqual({ uri: R1, url: 'https://pubmed.ncbi.nlm.nih.gov/16914701/', site: 'pubmed.ncbi.nlm.nih.gov',
    title: 'Daptomycin versus standard therapy for bacteremia and endocarditis caused by Staphylococcus aureus.',
    shortName: 'N Engl J Med', journal: 'The New England journal of medicine', year: 2006,
    authors: 'Fowler VG Jr, Boucher HW, Corey GR, et al.', pmid: '16914701', type: 'trial' });
});
it('types a society guideline without calling NCBI', async () => { /* 302 → https://www.idsociety.org/practice-guideline/x → type 'guideline', shortName 'IDSA', no esummary call */ });
it('falls back for disallowed URIs, unresolved redirects, and NCBI failure while enriching the rest', async () => {
  /* inputs: 'https://evil.example/a' (no fetch), grounding URI → 200 (no Location), PubMed source with esummary 429, idsociety source
     → first three equal fallbackSource(input) except the PubMed one keeps url/site/type 'journal'; idsociety still 'guideline' */
});
it('returns fallbacks for sources unfinished when the overall budget elapses', async () => { /* one hanging redirect, totalTimeoutMs 30 → fallback */ });
it('serves repeat URIs from the cache', async () => { /* call twice with same cache → fetch count unchanged on second call */ });
it('preserves input order and length', async () => { /* 3 mixed inputs → output uris in same order */ });

// route.test.ts
it('rejects bad bodies with 400', async () => {
  for (const body of ['not json', JSON.stringify({}), JSON.stringify({ sources: Array(41).fill({ uri: 'u', title: 't' }) }), JSON.stringify({ sources: [{ uri: 1 }] })])
    expect((await POST(new Request('http://x/api/sources/resolve', { method: 'POST', body }))).status).toBe(400);
});
it('returns fallbacks for disallowed URIs without fetching', async () => {
  const spy = vi.spyOn(globalThis, 'fetch');
  const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ sources: [{ uri: 'https://evil.example/a', title: 'cdc.gov' }] }) }));
  expect((await res.json()).sources[0]).toMatchObject({ url: null, shortName: 'CDC', type: 'agency' });
  expect(spy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement** `enrich.ts` and the route.
- [ ] **Step 4: Run tests** — `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** — `git commit -m "Add verified source enrichment route for Copilot references"`

---

### Task 9: Copilot prompt and request builder

**Files:**
- Modify: `lib/ai-prompts.ts` (replace `INFUSION_SYSTEM_PROMPT` with `INFUSION_QA_SYSTEM_PROMPT`; add `COPILOT_DEPTH_ADDENDA`)
- Create: `lib/copilot/request.ts`
- Test: `lib/copilot/request.test.ts`

**Interfaces:**
- Produces:
  - `INFUSION_QA_SYSTEM_PROMPT: string` — written from spec §7. Must contain verbatim: `Do not write citation markers like [1], source lists, or URLs` and the closing format block ` ```followups ` with three `- ` items and a closing ` ``` `.
  - `COPILOT_DEPTH_ADDENDA: Record<Depth, string>` — `quick`: `Be brief: 1–3 short paragraphs or a short list; skip background.`; `thorough`: `Give a complete answer: lead with the bottom line, then short sections as the question requires.`
  - `interface CopilotRequest { system: string; messages: ChatMessage[]; thinkingLevel: 'low' | 'high' }`
  - `buildCopilotRequest(args: { history: CopilotTurn[]; question: string; depth: Depth; lookupContext: string }): CopilotRequest` — `system = PROMPT + '\n\n' + addendum + (lookupContext ? '\n\n---\n\n' + lookupContext : '')`.
- Note: `INFUSION_SYSTEM_PROMPT`'s only importer is `components/InfusionConsult.tsx`, rewritten in Task 13; until then keep the old export so the app compiles, and delete it in Task 13.

- [ ] **Step 1: Write the failing tests**

```ts
it('combines prompt, depth addendum, and lookup context', () => {
  const r = buildCopilotRequest({ history: [], question: 'Q?', depth: 'quick', lookupContext: 'LOOKUP' });
  expect(r.system).toBe(`${INFUSION_QA_SYSTEM_PROMPT}\n\n${COPILOT_DEPTH_ADDENDA.quick}\n\n---\n\nLOOKUP`);
  expect(r.thinkingLevel).toBe('low');
});
it('uses high thinking for thorough and omits an empty lookup section', () => {
  const r = buildCopilotRequest({ history: [], question: 'Q?', depth: 'thorough', lookupContext: '' });
  expect(r.thinkingLevel).toBe('high');
  expect(r.system.endsWith(COPILOT_DEPTH_ADDENDA.thorough)).toBe(true);
});
it('sends the last six finished turns as user/assistant pairs, then the question', () => {
  // 8 turns: t1..t8 done, plus one 'error' turn and one 'done' turn with empty answer interleaved → only the last 6 eligible kept
  // expect messages = [user q3, assistant a3, …, user q8, assistant a8, user 'Q?']
});
it('tells the model not to write citations and to end with a follow-up block', () => {
  expect(INFUSION_QA_SYSTEM_PROMPT).toContain('Do not write citation markers like [1], source lists, or URLs');
  expect(INFUSION_QA_SYSTEM_PROMPT).toContain('```followups');
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement** the prompt from spec §7 (role; research order FDA label/DailyMed → IDSA, ASHP, INS, NCCN, ONS guidelines → primary literature → stability/compatibility; use verified lookup data and state disagreements; bottom line in the first 1–2 sentences; size to the question; bold doses, rates, concentrations, stability times, thresholds; tables for comparisons/schedules; "Important caveats" when relevant; say in words when a number can't be confirmed; reuse patient details from earlier turns and state assumptions; decision support for clinicians, not patient-directed; flag cases needing inpatient care; end with the follow-up block) and the builder.
- [ ] **Step 4: Run tests** — Expected: all pass.
- [ ] **Step 5: Commit** — `git commit -m "Add Copilot Q&A prompt and request builder"`

---

### Task 10: Turn runner, real transport, and demo transport

**Files:**
- Create: `lib/copilot/run-turn.ts`, `lib/copilot/transport.ts`, `lib/copilot/demo.ts`
- Test: `lib/copilot/run-turn.test.ts`, `lib/copilot/demo.test.ts`

**Interfaces:**
- Consumes: `buildCopilotRequest` (Task 9), `splitFollowUps` (Task 1), `fallbackSource` (Task 2), `titleFdaLabels` (Task 2), `placeCitations` (Task 3), `streamAI` (Task 5), `runPharmacyLookup` / `formatLookupForPrompt` from `@/lib/pharmacy-lookup`.
- Produces:
  - `interface CopilotTransport { lookup(question: string, signal: AbortSignal): Promise<LookupResult | null>; stream(req: CopilotRequest, cb: { onText(full: string): void; onSources(s: GroundingSource[]): void; onSupports(s: CitationSupport[]): void }, signal: AbortSignal): Promise<void>; resolve(sources: GroundingSource[], signal: AbortSignal): Promise<EnrichedSource[]> }`
  - `runTurn(t: CopilotTransport, input: { history: CopilotTurn[]; question: string; depth: Depth }, onUpdate: (patch: TurnPatch) => void, signal: AbortSignal, opts?: { lookupTimeoutMs?: number /* 12000 */; now?: () => number }): Promise<void>`
  - `realTransport: CopilotTransport` (in `transport.ts`; resolve = `POST /api/sources/resolve`)
  - `isDemoEnabled(search: string): boolean` — `process.env.NODE_ENV === 'development' && new URLSearchParams(search).has('copilotDemo')`
  - `DEMO_TURN` (fixture: `question`, `answerText` incl. follow-up block, `sources: GroundingSource[]`, `supports: CitationSupport[]`, `enriched: EnrichedSource[]`, `lookup: LookupResult`) and `demoTransport: CopilotTransport` (lookup after 600 ms; streams `answerText` in ~40-char chunks every 30 ms; emits sources and supports at the end; resolve after 800 ms; all honor `signal`).

Runner sequence: patch `{ status: 'lookup', lookupState: 'pending' }` → race lookup vs `lookupTimeoutMs` → patch `{ lookup, lookupState: 'ok' | 'failed' | 'timeout' }` (late lookups are ignored) → patch `{ status: 'streaming' }` → stream with `buildCopilotRequest` (lookup context from `formatLookupForPrompt` only when `ok`); on each text update patch `{ answer: body, firstTokenAt }` using `splitFollowUps(text)`; sources patched as `fallbackSource` list, supports as received → after the stream, patch final `{ answer, followUps }` from `splitFollowUps(text, true)` and `{ status: 'resolving' }` → resolve; on success patch `{ sources: titleFdaLabels(enriched, lookup) }`, on failure keep fallbacks → patch `{ status: 'done' }`. Abort at any point → `{ status: 'stopped' }` (partial answer kept). Stream error → `{ status: 'error', error: message }` (partial kept).

- [ ] **Step 1: Write the failing tests** (fake transport; `vi.useFakeTimers()` for the timeout case)

```ts
it('runs lookup → stream → resolve and ends done', async () => { /* final merged patches: status 'done', answer body without block, followUps 3, supports, sources enriched + label titled */ });
it('passes lookup context into the request system prompt', async () => { /* stream receives req.system containing formatLookupForPrompt(lookup) */ });
it('proceeds without the lookup after 12 s and records a timeout', async () => { /* lookup never resolves; advance 12000 ms → lookupState 'timeout', req.system has no lookup section */ });
it('records a failed lookup and continues', async () => { /* lookup rejects → lookupState 'failed', status 'done' */ });
it('keeps the partial answer and ends stopped when aborted mid-stream', async () => { /* abort after first chunk → status 'stopped', answer = first chunk, resolve not called */ });
it('ends in error with the message, keeping partial text', async () => { /* stream throws Error('boom') after text → status 'error', error 'boom' */ });
it('keeps fallback sources when resolve fails', async () => { /* resolve rejects → status 'done', sources = fallbackSource(...) list */ });

// demo.test.ts
it('demo fixture exercises the citation edge cases', () => {
  const body = splitFollowUps(DEMO_TURN.answerText, true);
  expect(body.followUps).toHaveLength(3);
  const p = placeCitations(body.body, DEMO_TURN.supports, DEMO_TURN.enriched.length);
  expect(p.unplaced).toBe(1);
  expect(p.refs.length).toBeGreaterThanOrEqual(5);
  expect(sourceMix(p.refs.map(i => DEMO_TURN.enriched[i])).groups.length).toBeGreaterThanOrEqual(4);
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement** the runner, real transport, and demo. Write `DEMO_TURN` as a realistic infliximab preparation/administration answer: bottom line first, two `###` sections, a table, bold numbers, an "Important caveats" section, the follow-up block; ≥ 6 supports including one with two sources and one whose text is absent from the answer; sources spanning FDA label, guideline, trial, journal, and agency types; enriched metadata for PubMed entries taken from real `esummary` output; a lookup with one `warning` safety flag. Demo data must not be imported by non-demo code paths except through `isDemoEnabled`.
- [ ] **Step 4: Run tests and typecheck** — `npx vitest run` and `npx tsc --noEmit` — Expected: pass.
- [ ] **Step 5: Commit** — `git commit -m "Add Copilot turn runner with real and demo transports"`

---

### Task 11: Answer components

**Files:**
- Create: `lib/copilot/markdown.ts` — move `buildDrugMatcher`, `injectDrugLinks`, `repairBriefMarkdown`, and the `DrugMatcher` type verbatim from `components/InfusionConsult.tsx`.
- Test: `lib/copilot/markdown.test.ts`
- Modify: `app/layout.tsx` (add `Source_Serif_4` with `variable: '--font-serif'`, `subsets: ['latin']`, `display: 'swap'`; append the variable to `<html>` classes)
- Create: `components/copilot/AnswerBlock.tsx`, `CitationChip.tsx`, `ReferenceList.tsx`, `SourceMixBadge.tsx`, `StepTimeline.tsx`, `SafetyStrip.tsx`

**Interfaces:**
- Consumes: Tasks 2–3 pure functions; `PharmacyLookupPanel({ lookup, isLoading })`; `emitOpenDrug`.
- Produces (props):
  - `AnswerBlock({ markdown, refs, sources, drugMatcher, referencesId }: { markdown: string; refs: number[]; sources: EnrichedSource[]; drugMatcher: DrugMatcher; referencesId: string })` — renders `injectDrugLinks(repairBriefMarkdown(markdown), drugMatcher)` with `react-markdown` + `remark-gfm`, serif prose (`font-[family-name:var(--font-serif)]`, 16px/26px); `href` `#cite:` → `CitationChip`; `#drug:` → existing drug chip behavior; other links open in a new tab.
  - `CitationChip({ refNums, refs, sources, referencesId })` — pill button labeled `chipLabel(...)`; hover, focus, or tap opens a popover listing each reference (number, title linked to `url` when present, `journal ?? site` · year · authors, `TYPE_LABEL` tag, "Recent" via `isRecent`) and a "See all references" link to `#${referencesId}`; Escape and outside click close it.
  - `ReferenceList({ id, refs, sources, heading, note }: { id: string; refs: number[]; sources: EnrichedSource[]; heading: 'References' | 'Sources searched'; note?: string })` — collapsible, open by default, numbered.
  - `SourceMixBadge({ sources }: { sources: EnrichedSource[] })` — shows `sourceMix(sources).text`; click opens the sources grouped by type; renders nothing for an empty mix.
  - `StepTimeline({ turn }: { turn: CopilotTurn })` — one-line summary, expandable; steps with live state from `turn.status`/`turn.lookupState`; "Identified drugs" lists `turn.lookup?.classification.drug_names`; failed/timeout shows "FDA lookup unavailable" in amber; expanded view renders `PharmacyLookupPanel`.
  - `SafetyStrip({ flags }: { flags: SafetyFlag[] })` — only `critical` (rose) and `warning` (amber) flags; nothing otherwise.

- [ ] **Step 1: Write the failing test** for the moved helpers

```ts
it('links a drug name once per segment and leaves citation markers alone', () => {
  const m = buildDrugMatcher();
  const out = injectDrugLinks('Infliximab 5 mg/kg. [cite](#cite:1) Infliximab again.', m);
  expect(out).toBe('[Infliximab](#drug:infliximab) 5 mg/kg. [cite](#cite:1) [Infliximab](#drug:infliximab) again.');
});
```
(The marker splits the text into two safe segments, so each segment links its first mention.)

- [ ] **Step 2: Run to verify failure** — Expected: FAIL (module missing).
- [ ] **Step 3: Move the helpers** into `lib/copilot/markdown.ts` (keep `InfusionConsult.tsx` importing them from there so it still compiles) — Expected test PASS.
- [ ] **Step 4: Add the font and build the six components** per the props above, using the theme classes from Global Constraints.
- [ ] **Step 5: Verify** — `npx vitest run && npx tsc --noEmit && npx eslint lib/copilot components/copilot app/layout.tsx` — Expected: pass, no ESLint errors.
- [ ] **Step 6: Commit** — `git commit -m "Add Copilot answer, citation, reference, and timeline components"`

---

### Task 12: Composer, home screen, examples, history drawer

**Files:**
- Create: `lib/copilot/examples.ts`, `components/copilot/Composer.tsx`, `components/copilot/CopilotHome.tsx`, `components/copilot/HistoryDrawer.tsx`
- Test: `lib/copilot/examples.test.ts`

**Interfaces:**
- Produces:
  - `SHORTCUTS: { label: 'Dose & renal adjustment' | 'Preparation & stability' | 'Infusion reactions'; text: string }[]` (3); `EXAMPLE_CATEGORIES: { title: string; examples: string[] }[]` — 10 categories in this order: Dosing & renal adjustment; Preparation, stability & BUD; Administration & rates; Premeds & infusion reactions; Monitoring & TDM; Compatibility & line access; OPAT & home infusion; Biologics & biosimilars; Oncology supportive care; Shortages & alternatives — each with 2–3 example questions.
  - `Composer({ value, onChange, onSubmit, onStop, depth, onDepthChange, busy, variant }: { value: string; onChange(v: string): void; onSubmit(): void; onStop(): void; depth: Depth; onDepthChange(d: Depth): void; busy: boolean; variant: 'hero' | 'docked' })` — auto-growing textarea; Enter submits, Shift+Enter inserts a newline; depth menu with the two labels and descriptions; send arrow, replaced by "Stop" while `busy`; placeholder per variant.
  - `CopilotHome({ composer, onPickExample }: { composer: ReactNode; onPickExample(text: string): void })` — title, subtitle, composer slot, trust line, notice, shortcut chips, "Explore example questions" expander.
  - `HistoryDrawer({ open, onClose, threads, activeThreadId, onOpen, onDelete, onClearAll, storageAvailable })` — left drawer (overlay on narrow widths), threads sorted by `updatedAt` desc with relative dates, per-thread delete, "Clear all history" (confirm with `window.confirm`), notice "Saved in this browser only" or "History can't be saved in this browser" when `!storageAvailable`.

- [ ] **Step 1: Write the failing test**

```ts
it('pins the shortcut labels and the ten example categories', () => {
  expect(SHORTCUTS.map(s => s.label)).toEqual(['Dose & renal adjustment', 'Preparation & stability', 'Infusion reactions']);
  expect(EXAMPLE_CATEGORIES).toHaveLength(10);
  for (const c of EXAMPLE_CATEGORIES) expect(c.examples.length).toBeGreaterThanOrEqual(2), expect(c.examples.length).toBeLessThanOrEqual(3);
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement** `examples.ts` (test PASS), then the three components.
- [ ] **Step 4: Verify** — `npx vitest run && npx tsc --noEmit && npx eslint lib/copilot components/copilot` — Expected: pass.
- [ ] **Step 5: Commit** — `git commit -m "Add Copilot composer, home screen, examples, and history drawer"`

---

### Task 13: Thread view and container wiring, verified in the browser

**Files:**
- Create: `components/copilot/useCopilot.ts`, `components/copilot/TurnView.tsx`, `components/copilot/ThreadView.tsx`
- Modify: `components/InfusionConsult.tsx` (rewrite as the container; keep `export function InfusionConsult({ prefillScenario })`)
- Modify: `lib/ai-prompts.ts` (delete `INFUSION_SYSTEM_PROMPT`)

**Interfaces:**
- Consumes: everything above; `WaitGame({ active })`.
- Produces:
  - `useCopilot(): { state: CopilotState; activeThread: CopilotThread | null; busy: boolean; storageAvailable: boolean; ask(question: string, depth: Depth): void; stop(): void; retry(turnId: string): void; newQuestion(): void; openThread(id: string): void; deleteThread(id: string): void; clearAll(): void }` — loads threads on mount (`window.localStorage` accessed inside `try`); saves after every state change; one `AbortController` per running turn; `newQuestion`, `openThread`, `deleteThread`, and `clearAll` abort a running turn first (Review Focus 1); `retry` re-asks the same question and depth as a new turn; transport is `demoTransport` when `isDemoEnabled(location.search)`, else `realTransport`.
  - `TurnView({ turn, isLatest, onFollowUp, onRetry, drugMatcher })` — question echo; meta row (depth tag, time, `SourceMixBadge` over cited sources); `SafetyStrip`; `StepTimeline`; "Play while you wait" link (Thorough only, while `status === 'streaming'` and no `firstTokenAt`) that reveals `WaitGame`; `AnswerBlock` (no chips while streaming); `ReferenceList` ("References" when any chip was placed; otherwise "Sources searched" with the note, when sources exist); "Copy answer" (uses `toPlainText`, shows "Copied" for 2 s); "Stopped"/error notes with "Retry"; "Suggested follow-ups" when `isLatest && followUps.length`.
  - `ThreadView({ thread, ...handlers })` — maps turns; scrolls the newest turn into view when it starts.
  - Container: top bar with "History" and "New question"; `CopilotHome` with the hero `Composer` when no active thread, else `ThreadView` plus the docked `Composer` pinned to the bottom of the tab; prefill from `prefillScenario` starts a new question with the composer filled (not sent).

- [ ] **Step 1: Implement** the hook, views, and container; delete `INFUSION_SYSTEM_PROMPT` and the old citation/brief code from `InfusionConsult.tsx`.
- [ ] **Step 2: Verify statically** — `npx vitest run && npx tsc --noEmit && npx eslint components/copilot components/InfusionConsult.tsx lib && npx next build` — Expected: all pass, build succeeds.
- [ ] **Step 3: Browser walkthrough with the demo** — start the `switchrx-dev` preview, open `http://localhost:3000/?copilotDemo=1`, Infusion Copilot tab. Confirm each, fixing anything that fails:
  1. Home: title, trust line, notice, three shortcuts fill the box without sending, examples expander lists 10 categories.
  2. Ask in Thorough: timeline animates; "Play while you wait" appears before the first token; text streams with no chips and no visible follow-up block.
  3. After the stream: chips appear on the right sentences; hovering a chip shows its reference card; "See all references" jumps to the list; the absent-text support has no chip but its source is still listed.
  4. Source-mix badge text and grouped popover; amber safety strip for the fixture's warning flag.
  5. Click a suggested follow-up → second turn in the same thread.
  6. Stop mid-stream → "Stopped" with partial text; "Retry" re-runs.
  7. Reload → thread restored from History; delete one thread; "Clear all history".
  8. "New question" during a running answer stops it, and the old thread shows "Stopped".
  9. Drug chip opens Drug Reference; "Ask Copilot" from Drug Reference prefills a new question.
  10. Light theme, and a 768 px-wide window: readable, no horizontal scroll inside the tab.
  11. No console errors.
- [ ] **Step 4: Commit** — `git commit -m "Wire the conversational Infusion Copilot"`

---

### Task 14: Full verification, preview deployment, live check

**Files:** none (fixes only if a check fails)

- [ ] **Step 1: Run every check** — `npx vitest run && npx tsc --noEmit && npx next build`, and `npx eslint` on every file changed on the branch (`git diff --name-only main...HEAD -- '*.ts' '*.tsx'`) — Expected: all tests pass, build succeeds, no ESLint errors in changed files.
- [ ] **Step 2: Push the branch** — `git push -u origin copilot-qa`.
- [ ] **Step 3: Find the Vercel preview URL** for the latest `copilot-qa` deployment (Vercel tools or `gh pr`/commit status) and wait for it to be Ready. If the preview requires Vercel sign-in, ask the user to open it in the browser pane and sign in. If AI calls fail with "GEMINI_API_KEY is not set on the server", ask the user to enable that variable for the Preview environment in Vercel and redeploy (never set it yourself).
- [ ] **Step 4: Live check on the preview** (no demo flag):
  1. Quick: "Max infusion rate for vancomycin?" — short answer, chips present.
  2. Thorough: "65 kg patient, CrCl 35, starting infliximab 5 mg/kg — prep, rate, premeds, monitoring?" — sectioned answer, PubMed/FDA references with journal and year, source-mix badge.
  3. Follow-up: "What if they had an infusion reaction last time?" — answer reuses the patient context.
  4. Open three chip references and confirm each opens the page its card names (this is the bug the redesign fixes).
  5. IDSA Antibiotic Advisor and Clinical Chat still answer (regression).
- [ ] **Step 5: Report** results to the user with screenshots; do not merge to `main` until the user approves.
