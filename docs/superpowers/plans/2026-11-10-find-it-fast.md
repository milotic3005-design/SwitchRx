# Find It Fast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home banner with a launcher and add one search (Cmd+K) that opens any drug, calculator or tool from any screen.

**Architecture:** `app/page.tsx` owns navigation through one `go(target)` function. Pure modules under `lib/launcher/` hold the catalog, the search, the recent list and the keyboard state. Three components under `components/launcher/` render them. The tools take open requests as `{ id, token }` props.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind 4, lucide-react, Vitest 4 (node environment, `**/*.test.ts`, no DOM).

**Spec:** `docs/superpowers/specs/2026-11-10-find-it-fast-design.md`

## Global Constraints

- Change nothing in `data/` and no calculation function.
- New UI uses no text smaller than 13px.
- Use the app's remapped theme classes (`text-white`, `text-slate-*`, `text-violet-*`, `bg-white/5`, `border-white/10`, `glass-panel`, `glass-card`). Amber and rose are for safety signals only. Every screen works in dark and light themes.
- The search dialog renders inside the root `<div>` of `app/page.tsx`. Never portal it to `body` and never place it inside the header `<nav>`.
- Storage keys: `switchrx.recents.v1`, `switchrx.calculators.last.v1`. Wrap every storage call in try/catch. Read storage through `useSyncExternalStore` with a `null` server snapshot, never in an effect that sets state. The snapshot is the raw stored string (a primitive); parse it with `useMemo`.
- Apply an open request with the render-time token pattern used in `components/InfusionConsult.tsx` (`if (req && req.token !== seenToken) { setSeenToken(req.token); … }`). The lint rule `react-hooks/set-state-in-effect` rejects the effect form.
- Tests run in node. Put logic in pure modules; components hold markup and wiring.
- Known lint errors that predate this work: `app/page.tsx` (theme effect), `components/WaitGame.tsx:59` and `:334`. Add none.
- End every commit message with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- Never stop a process you did not start. Never push without the user's go-ahead.

## Review Focus

1. Cmd+K pressed while typing in a tool's input (the Copilot question box): the dialog opens, the typed text stays, and closing returns focus to that input. Checked in Task 7.
2. Queries with case, spaces or punctuation ("5-FU", "pip tazo", "  VANC "): they match as the plain form does. Tested in Tasks 1 and 3.
3. Stored data that is malformed or stale (bad JSON, wrong shape, an unknown drug id, an unknown last-calculator id): the app loads with an empty list or the default calculator. Tested in Tasks 2 and 4.
4. The same request twice in a row (open CrCl, pick another calculator by hand, open CrCl again): the second request applies. Checked in Tasks 5 and 6.
5. A query that matches nothing and holds quotes or markup (`<b>"x"</b>`), or is only spaces: the Copilot row carries the literal trimmed text; spaces alone count as empty. Tested in Task 3.

---

### Task 1: Move the drug matcher to `lib/drug-search.ts`

**Files:**
- Create: `lib/drug-search.ts`, `lib/drug-search.test.ts`
- Modify: `components/MixingGuide.tsx:130-156` (delete `norm`, `SEARCH_ALIASES`, `searchDrugs`; import them)

**Interfaces:**
- Produces: `norm(s: string): string`, `SEARCH_ALIASES: Record<string, string>`, `searchDrugs(q: string, limit = 8): Drug[]` (`Drug` from `@/lib/iv-reference-types`).

- [ ] **Step 1: Write the failing test** in `lib/drug-search.test.ts`

```ts
const names = (q: string, limit?: number) => searchDrugs(q, limit).map(d => d.genericName);

it('ranks an exact generic match first', () => { expect(names('vancomycin')[0]).toBe('Vancomycin'); });
it('matches a brand name', () => { expect(names('remicade')).toContain('Infliximab'); });
it('matches abbreviations', () => {
  expect(names('ivig')[0]).toBe('Immune Globulin IV');
  expect(names('5fu')[0]).toBe('Fluorouracil');
});
it('ignores case, spaces and punctuation', () => {
  expect(names('  VANC ')).toEqual(names('vanc'));
  expect(names('5-FU')).toEqual(names('5fu'));
  expect(names('pip tazo')).toEqual(names('piptazo'));
});
it('returns nothing for an empty or blank query', () => {
  expect(searchDrugs('')).toEqual([]);
  expect(searchDrugs('   ')).toEqual([]);
});
it('caps the list', () => { expect(searchDrugs('a', 3)).toHaveLength(3); });
```

- [ ] **Step 2: Run it.** `npx vitest run lib/drug-search.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Move the three declarations** from `components/MixingGuide.tsx` into `lib/drug-search.ts` unchanged, export them, and import `searchDrugs` in `MixingGuide.tsx`.
- [ ] **Step 4: Run it.** `npx vitest run lib/drug-search.test.ts && npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit.** `git commit -m "Move the drug matcher out of the Mixing Guide"`

---

### Task 2: Catalog of tools and calculators

**Files:**
- Create: `lib/launcher/catalog.ts`, `lib/launcher/catalog.test.ts`

**Interfaces:**
- Produces:

```ts
export type TabId = 'switching' | 'infusion' | 'calculators' | 'drugref' | 'mixing' | 'breakroom';
export interface Tool { tab: TabId; label: string; shortLabel: string }
export const TOOLS: readonly Tool[];
export function toolLine(tab: TabId, counts: { drugs: number; calculators: number }): string;

export type CalcGroupId = 'antimicrobials' | 'infusion' | 'patient' | 'anemia-labs';
export const CALC_GROUPS: readonly { id: CalcGroupId; label: string }[];
export type CalcId = 'idsa-abx' | 'vanco' | 'cadd' | 'diluent' | 'ivig' | 'biolrate'
  | 'crcl' | 'bodywt' | 'calcium' | 'iron' | 'esa' | 'hbv';
export interface CalculatorEntry { id: CalcId; label: string; group: CalcGroupId; keywords: readonly string[] }
export const CALCULATORS: readonly CalculatorEntry[];
export const DEFAULT_CALC: CalcId; // 'cadd'
export const LAST_CALC_KEY = 'switchrx.calculators.last.v1';
export function isCalcId(x: unknown): x is CalcId;
```

Pinned values:

| `tab` | `label` | `shortLabel` | `toolLine` |
|---|---|---|---|
| switching | Switching Protocols | Switching | Find replacement therapies when a medication has to change. |
| infusion | Infusion Copilot | Copilot | Ask any infusion question and get a cited answer. |
| calculators | Clinical Calculators | Calculators | `${calculators} dosing, rate and lab calculators.` |
| drugref | Drug Reference | Reference | `Compounding, stability and safety data for ${drugs} drugs.` |
| mixing | Mixing Guide | Mixing | Mix, administer and store cards at a glance. |
| breakroom | Break Room | Break Room | Short games for a mental reset. |

| Group `id` / `label` | Calculators in order (`id`: `label`) | 
|---|---|
| antimicrobials / Antimicrobials | idsa-abx: IDSA Antibiotic Advisor; vanco: Vancomycin AUC Dosing; cadd: CADD Bag Calculator |
| infusion / Infusion prep & rates | diluent: Diluent Volume / Bag Prep; ivig: IVIG Infusion Rate; biolrate: Biologic Rate Titration |
| patient / Patient measures | crcl: CrCl (Cockcroft-Gault); bodywt: Body Weight & BMI; calcium: Corrected Calcium |
| anemia-labs / Anemia & labs | iron: Iron Deficit (Ganzoni); esa: ESA Dosing (CKD Anemia); hbv: HBV Serology Interpreter |

Keywords: idsa-abx `antibiotic, idsa, infection, abx`; vanco `vancomycin, auc, trough, kinetics`; cadd `cadd, pump, opat`; diluent `diluent, bag prep, volume`; ivig `ivig, immune globulin, titration`; biolrate `biologic, rate ladder, titration`; crcl `creatinine, clearance, cockcroft, gault, renal, kidney`; bodywt `bmi, ibw, adjbw, ideal, adjusted, weight`; calcium `calcium, albumin, corrected`; iron `iron, ganzoni, deficit, hemoglobin`; esa `esa, epoetin, darbepoetin, ckd, anemia`; hbv `hbv, hepatitis b, serology, hbsag`.

- [ ] **Step 1: Write the failing test**

```ts
it('lists six tools in menu order', () => {
  expect(TOOLS.map(t => t.tab)).toEqual(['switching', 'infusion', 'calculators', 'drugref', 'mixing', 'breakroom']);
});
it('has twelve calculators with unique ids, each in a known group', () => {
  expect(CALCULATORS).toHaveLength(12);
  expect(new Set(CALCULATORS.map(c => c.id)).size).toBe(12);
  const groups = new Set(CALC_GROUPS.map(g => g.id));
  for (const c of CALCULATORS) expect(groups.has(c.group), c.id).toBe(true);
});
it('puts three calculators in each of the four groups', () => {
  for (const g of CALC_GROUPS) expect(CALCULATORS.filter(c => c.group === g.id), g.id).toHaveLength(3);
});
it('builds the two counted lines from the counts it is given', () => {
  expect(toolLine('calculators', { drugs: 249, calculators: 12 })).toBe('12 dosing, rate and lab calculators.');
  expect(toolLine('drugref', { drugs: 249, calculators: 12 })).toBe('Compounding, stability and safety data for 249 drugs.');
});
it('recognises calculator ids', () => {
  expect(isCalcId('crcl')).toBe(true);
  for (const bad of ['', 'CRCL', 'nope', null, 7]) expect(isCalcId(bad), String(bad)).toBe(false);
  expect(DEFAULT_CALC).toBe('cadd');
});
```

- [ ] **Step 2: Run it.** `npx vitest run lib/launcher/catalog.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Write `lib/launcher/catalog.ts`** with the values above. `CALCULATORS` lists entries group by group in the table's order.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Add the catalog of tools and calculators"`

---

### Task 3: Search across drugs, calculators and tools

**Files:**
- Create: `lib/launcher/search.ts`, `lib/launcher/search.test.ts`

**Interfaces:**
- Consumes: `norm`, `searchDrugs` (Task 1); `TOOLS`, `CALCULATORS`, `CALC_GROUPS`, `TabId`, `CalcId` (Task 2).
- Produces:

```ts
export type DrugDest = 'mixing' | 'reference' | 'copilot';
export type Target =
  | { kind: 'tool'; tab: TabId }
  | { kind: 'calculator'; id: CalcId }
  | { kind: 'drug'; id: string; dest: DrugDest }
  | { kind: 'ask'; text: string };
export interface RecentItem { kind: 'drug' | 'calculator'; id: string; dest?: DrugDest }

export const DRUG_ACTIONS: readonly { dest: DrugDest; label: string }[];
// mixing 'Mixing Guide', reference 'Drug Reference', copilot 'Ask Copilot' — in that order
export const DEST_PLACE: Record<DrugDest, string>;
// mixing 'Mixing Guide', reference 'Drug Reference', copilot 'Infusion Copilot'

export type ResultRow =
  | { kind: 'drug'; key: string; id: string; title: string; subtitle: string; dest?: DrugDest }
  | { kind: 'calculator'; key: string; id: CalcId; title: string; subtitle: string }
  | { kind: 'tool'; key: string; tab: TabId; title: string }
  | { kind: 'ask'; key: string; text: string; title: string };
export interface ResultSection { heading: 'Recent' | 'Drugs' | 'Calculators' | 'Tools' | null; rows: ResultRow[] }

export function searchAll(query: string, recents: RecentItem[]): ResultSection[];
export function rowTarget(row: ResultRow, action?: number): Target;
```

Rules:
- A drug row has `title` = generic name, `subtitle` = brand name. A drug row built from a recent item also has `dest`, and its `subtitle` is `DEST_PLACE[dest]`.
- A calculator row has `subtitle` = its group label.
- Typed query: sections Drugs (max 6, from `searchDrugs(query, 6)`), Calculators (max 4), Tools (max 3). Empty sections are left out.
- Calculator and tool match score, on `norm` forms, lowest wins, ties keep catalog order: 1 label starts with the query; 2 a label word or a keyword starts with it; 3 the label contains it; 4 a keyword contains it.
- Nothing matches: one section, `heading: null`, one `ask` row. `text` is the trimmed query. `title` is `Ask Infusion Copilot about “${text}”`.
- Empty or blank query: section Recent (one row per recent item, left out when there are none), then Tools with all six. A recent item whose drug or calculator no longer exists gets no row.
- `rowTarget`: a drug row gives `dest` = the row's own `dest` if set, else `DRUG_ACTIONS[action ?? 0].dest`.

- [ ] **Step 1: Write the failing test**

```ts
const heads = (q: string, r: RecentItem[] = []) => searchAll(q, r).map(s => s.heading);
const titles = (q: string, heading: string) => searchAll(q, []).find(s => s.heading === heading)?.rows.map(r => r.title) ?? [];

it('lists drugs, then calculators, then tools', () => {
  expect(heads('vanc')).toEqual(['Drugs', 'Calculators']);
  expect(titles('vanc', 'Drugs')[0]).toBe('Vancomycin');
  expect(titles('vanc', 'Calculators')).toEqual(['Vancomycin AUC Dosing']);
});
it('finds calculators by keyword', () => {
  expect(titles('ibw', 'Calculators')).toEqual(['Body Weight & BMI']);
  expect(titles('creatinine', 'Calculators')).toEqual(['CrCl (Cockcroft-Gault)']);
});
it('finds tools by name', () => { expect(titles('mixing', 'Tools')).toEqual(['Mixing Guide']); });
it('caps each section', () => {
  const s = searchAll('a', []);
  expect(s.find(x => x.heading === 'Drugs')!.rows.length).toBeLessThanOrEqual(6);
  expect((s.find(x => x.heading === 'Calculators')?.rows.length ?? 0)).toBeLessThanOrEqual(4);
  expect((s.find(x => x.heading === 'Tools')?.rows.length ?? 0)).toBeLessThanOrEqual(3);
});
it('ignores case, spaces and punctuation', () => {
  expect(searchAll('  CrCl ', [])).toEqual(searchAll('crcl', []));
});
it('offers the Copilot when nothing matches, with the literal text', () => {
  const [section] = searchAll('  <b>"zzqx"</b> ', []);
  expect(section.heading).toBeNull();
  expect(section.rows).toEqual([{ kind: 'ask', key: 'ask', text: '<b>"zzqx"</b>', title: 'Ask Infusion Copilot about “<b>"zzqx"</b>”' }]);
});
it('treats a blank query as empty: recents, then all six tools', () => {
  expect(heads('   ')).toEqual(['Tools']);
  expect(searchAll('', [])[0].rows).toHaveLength(6);
  const recents: RecentItem[] = [{ kind: 'drug', id: DRUG_DB[0].id, dest: 'reference' }, { kind: 'calculator', id: 'crcl' }];
  const [recent, tools] = searchAll('', recents);
  expect(recent.heading).toBe('Recent');
  expect(recent.rows[0]).toMatchObject({ kind: 'drug', title: DRUG_DB[0].genericName, subtitle: 'Drug Reference', dest: 'reference' });
  expect(recent.rows[1]).toMatchObject({ kind: 'calculator', id: 'crcl' });
  expect(tools.heading).toBe('Tools');
  expect(heads('', [{ kind: 'drug', id: 'nope', dest: 'mixing' }, { kind: 'calculator', id: 'old' }])).toEqual(['Tools']);
});
it('turns a row and an action into a target', () => {
  const drug = searchAll('vancomycin', [])[0].rows[0];
  expect(rowTarget(drug)).toMatchObject({ kind: 'drug', dest: 'mixing' });
  expect(rowTarget(drug, 1)).toMatchObject({ kind: 'drug', dest: 'reference' });
  expect(rowTarget(drug, 2)).toMatchObject({ kind: 'drug', dest: 'copilot' });
  const recentDrug = searchAll('', [{ kind: 'drug', id: DRUG_DB[0].id, dest: 'reference' }])[0].rows[0];
  expect(rowTarget(recentDrug, 0)).toMatchObject({ dest: 'reference' });
});
```

- [ ] **Step 2: Run it.** `npx vitest run lib/launcher/search.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Write `lib/launcher/search.ts`** to the rules above. Row keys: `drug:<id>`, `calc:<id>`, `tool:<tab>`, `ask`.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Add one search across drugs, calculators and tools"`

---

### Task 4: Recent list and keyboard state

**Files:**
- Create: `lib/launcher/recents.ts`, `lib/launcher/recents.test.ts`, `lib/launcher/panel-state.ts`, `lib/launcher/panel-state.test.ts`

**Interfaces:**
- Consumes: `RecentItem`, `ResultRow`, `Target`, `DRUG_ACTIONS`, `rowTarget` (Task 3).
- Produces:

```ts
// recents.ts
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;
export const RECENTS_KEY = 'switchrx.recents.v1';
export const RECENTS_MAX = 5;
export function addRecent(list: RecentItem[], item: RecentItem): RecentItem[]; // newest first, one entry per kind+id, capped
export function parseRecents(raw: string | null, known: { hasDrug(id: string): boolean; hasCalc(id: string): boolean }): RecentItem[];
export function readRecentsRaw(storage?: KeyValueStore | null): string | null;  // default: window.localStorage, null on the server
export function recordRecent(item: RecentItem, storage?: KeyValueStore | null): void; // read, add, write, then notify
export function subscribeRecents(onChange: () => void): () => void; // 'storage' event plus the window event 'switchrx:recents'

// panel-state.ts
export interface PanelState { active: number; action: number }
export const INITIAL_PANEL: PanelState; // { active: 0, action: 0 }
export type PanelKey = 'ArrowDown' | 'ArrowUp' | 'Tab' | 'ShiftTab';
export function panelKey(state: PanelState, key: PanelKey, rows: ResultRow[]): { state: PanelState; handled: boolean };
export function activeTarget(state: PanelState, rows: ResultRow[]): Target | null;
export function isPaletteShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean }): boolean;
```

Rules:
- `panelKey`: arrows move `active` and clamp at both ends; any change of `active` resets `action` to 0. Tab and ShiftTab cycle `action` 0→1→2→0 only when the active row is a drug row without its own `dest`; then `handled` is true. On any other row they return `handled: false`.
- `isPaletteShortcut`: true for `k` or `K` with exactly one of `metaKey`/`ctrlKey` and no `altKey`.

- [ ] **Step 1: Write the failing tests**

```ts
// recents.test.ts
const known = { hasDrug: (id: string) => id !== 'gone', hasCalc: (id: string) => id === 'crcl' || id === 'cadd' };
it('puts the newest first and keeps one entry per item, with the newest place', () => {
  let list = addRecent([], { kind: 'drug', id: 'a1', dest: 'mixing' });
  list = addRecent(list, { kind: 'calculator', id: 'crcl' });
  list = addRecent(list, { kind: 'drug', id: 'a1', dest: 'reference' });
  expect(list).toEqual([{ kind: 'drug', id: 'a1', dest: 'reference' }, { kind: 'calculator', id: 'crcl' }]);
});
it('caps the list at five', () => {
  let list: RecentItem[] = [];
  for (let i = 0; i < 7; i++) list = addRecent(list, { kind: 'drug', id: `d${i}`, dest: 'mixing' });
  expect(list.map(x => x.id)).toEqual(['d6', 'd5', 'd4', 'd3', 'd2']);
});
it('drops unknown ids and survives bad stored data', () => {
  const raw = JSON.stringify([{ kind: 'drug', id: 'gone', dest: 'mixing' }, { kind: 'calculator', id: 'crcl' }, { kind: 'calculator', id: 'old' }]);
  expect(parseRecents(raw, known)).toEqual([{ kind: 'calculator', id: 'crcl' }]);
  for (const bad of [null, '', '{', '{"a":1}', '[1,"x",null]', '[{"kind":"drug"}]', '[{"kind":"drug","id":"a1","dest":"elsewhere"}]'])
    expect(parseRecents(bad, known), String(bad)).toEqual([]);
});
it('records through a store and tolerates one that throws', () => {
  const data = new Map<string, string>();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  recordRecent({ kind: 'calculator', id: 'crcl' }, store);
  recordRecent({ kind: 'calculator', id: 'cadd' }, store);
  expect(parseRecents(readRecentsRaw(store), known).map(x => x.id)).toEqual(['cadd', 'crcl']);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  expect(() => recordRecent({ kind: 'calculator', id: 'crcl' }, broken)).not.toThrow();
  expect(readRecentsRaw(broken)).toBeNull();
  expect(readRecentsRaw(null)).toBeNull();
});

// panel-state.test.ts
const rows = [...searchAll('vanc', []).flatMap(s => s.rows)]; // [drug Vancomycin, …, calculator Vancomycin AUC Dosing]
it('moves with the arrows and clamps', () => {
  expect(panelKey(INITIAL_PANEL, 'ArrowUp', rows).state.active).toBe(0);
  let s = INITIAL_PANEL;
  for (let i = 0; i < rows.length + 3; i++) s = panelKey(s, 'ArrowDown', rows).state;
  expect(s.active).toBe(rows.length - 1);
});
it('cycles a drug row\'s three actions with Tab and resets on a row change', () => {
  let r = panelKey(INITIAL_PANEL, 'Tab', rows);
  expect(r).toEqual({ state: { active: 0, action: 1 }, handled: true });
  r = panelKey(panelKey(r.state, 'Tab', rows).state, 'Tab', rows);
  expect(r.state.action).toBe(0);
  expect(panelKey({ active: 0, action: 0 }, 'ShiftTab', rows).state.action).toBe(2);
  expect(panelKey({ active: 0, action: 2 }, 'ArrowDown', rows).state.action).toBe(0);
});
it('leaves Tab alone on a row with one action', () => {
  const last = { active: rows.length - 1, action: 0 };
  expect(panelKey(last, 'Tab', rows)).toEqual({ state: last, handled: false });
  expect(panelKey(INITIAL_PANEL, 'Tab', [])).toEqual({ state: INITIAL_PANEL, handled: false });
});
it('gives the active target', () => {
  expect(activeTarget({ active: 0, action: 1 }, rows)).toMatchObject({ kind: 'drug', dest: 'reference' });
  expect(activeTarget(INITIAL_PANEL, [])).toBeNull();
});
it('recognises the shortcut', () => {
  const e = { key: 'k', metaKey: false, ctrlKey: false, altKey: false };
  expect(isPaletteShortcut({ ...e, metaKey: true })).toBe(true);
  expect(isPaletteShortcut({ ...e, key: 'K', ctrlKey: true })).toBe(true);
  expect(isPaletteShortcut(e)).toBe(false);
  expect(isPaletteShortcut({ ...e, metaKey: true, ctrlKey: true })).toBe(false);
  expect(isPaletteShortcut({ ...e, ctrlKey: true, altKey: true })).toBe(false);
  expect(isPaletteShortcut({ ...e, key: 'j', metaKey: true })).toBe(false);
});
```

- [ ] **Step 2: Run them.** `npx vitest run lib/launcher/recents.test.ts lib/launcher/panel-state.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Write both modules.** `parseRecents` accepts only `kind` of `drug` or `calculator`, a string `id`, and for drugs a `dest` in `DRUG_ACTIONS`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "Add the recent list and the search keyboard state"`

---

### Task 5: Calculators page: groups, open requests, last used

**Files:**
- Modify: `components/ClinicalCalculators.tsx:40-54` (remove the local `CALCULATORS`), `:2270-2330` (the `ClinicalCalculators` export)

**Interfaces:**
- Consumes: `CALCULATORS`, `CALC_GROUPS`, `CalcId`, `DEFAULT_CALC`, `LAST_CALC_KEY`, `isCalcId` (Task 2); `recordRecent` (Task 4).
- Produces: `export function ClinicalCalculators({ openCalc }: { openCalc?: { id: CalcId; token: number } | null })`.

- [ ] **Step 1: Replace the selector and the panel switch.**
  - Selector: one row per group in `CALC_GROUPS`. Each row has the group label (13px, `text-slate-500`, fixed width so pills align) and that group's pills. Keep today's pill classes. The pills are plain buttons with `aria-pressed`.
  - Panel: `const PANELS: Record<CalcId, ComponentType> = { 'idsa-abx': IDSAAntibioticAdvisor, cadd: CADDCalculator, diluent: DiluentVolumeAdvisor, ivig: IVIGRateCalculator, biolrate: InfusionRateCalculator, vanco: VancomycinAUCCalculator, crcl: CrClCalculator, bodywt: BodyMetricsCalculator, iron: IronDeficitCalculator, esa: ESADosingCalculator, calcium: CorrectedCalciumCalculator, hbv: HBVSerologyInterpreter }`. Render `PANELS[activeCalc]`. A missing key is now a compile error.
- [ ] **Step 2: Add the state.**
  - `chosen: CalcId | null` in state. `stored` from `useSyncExternalStore` reading `LAST_CALC_KEY` (server snapshot `null`), kept only if `isCalcId`. `activeCalc = chosen ?? stored ?? DEFAULT_CALC`.
  - A pill click sets `chosen`, saves the id under `LAST_CALC_KEY` and calls `recordRecent({ kind: 'calculator', id })`.
  - An `openCalc` request sets `chosen` with the render-time token pattern and saves the id in an effect keyed on the token. It does not call `recordRecent`; `go` does (Task 7).
- [ ] **Step 3: Check types and lint.** `npx tsc --noEmit && npx eslint components/ClinicalCalculators.tsx`. Expected: no errors.
- [ ] **Step 4: Check in the browser** on your own dev server (`npx next dev -p 3111`; stop it by PID when done):
  - four labelled rows with three pills each, in the catalog order;
  - pick CrCl, reload, open Calculators: CrCl is open;
  - set `localStorage['switchrx.calculators.last.v1'] = 'nope'`, reload: CADD Bag is open and nothing errors in the console;
  - both themes; no text under 13px in the selector.
- [ ] **Step 5: Commit.** `git commit -m "Group the calculators and reopen the one used last"`

---

### Task 6: Mixing Guide and Drug Reference: open requests and recents

**Files:**
- Modify: `components/MixingGuide.tsx:698-720`, `components/DrugReference.tsx:803-820`, `:918`

**Interfaces:**
- Consumes: `recordRecent` (Task 4).
- Produces: `export function MixingGuide({ openDrug }: { openDrug?: { drugKey: string; token: number } | null })`. `drugKey` is a `Drug.id`.

- [ ] **Step 1: Mixing Guide.** An `openDrug` request selects the drug whose `id` equals `drugKey` (render-time token pattern): set `selectedId`, set `query` to its generic name, close the dropdown. An unknown id changes nothing. `choose` (the user's own pick) also calls `recordRecent({ kind: 'drug', id, dest: 'mixing' })`.
- [ ] **Step 2: Drug Reference.** The card click at `:918` also calls `recordRecent({ kind: 'drug', id: drug.id, dest: 'reference' })`. Leave the existing `openDrug` effect as it is.
- [ ] **Step 3: Check types and lint.** `npx tsc --noEmit && npx eslint components/MixingGuide.tsx components/DrugReference.tsx`. Expected: no new errors.
- [ ] **Step 4: Check in the browser:** pick a drug in the Mixing Guide and open a card in Drug Reference; `localStorage['switchrx.recents.v1']` holds both, newest first, with `dest` `reference` then `mixing`.
- [ ] **Step 5: Commit.** `git commit -m "Let the Mixing Guide open a requested drug and record recent drugs"`

---

### Task 7: Search panel, dialog, and page navigation

**Files:**
- Create: `components/launcher/SearchPanel.tsx`, `components/launcher/CommandPalette.tsx`, `components/launcher/icons.ts`, `components/launcher/hooks.ts`
- Modify: `app/page.tsx` (state, `go`, shortcut, header, palette mount)

**Interfaces:**
- Consumes: everything from Tasks 2–6.
- Produces:

```ts
// icons.ts
export const TOOL_ICONS: Record<TabId, LucideIcon>;
// switching Repeat, infusion Network, calculators Calculator, drugref FlaskConical, mixing Beaker, breakroom Coffee

// SearchPanel.tsx
export function SearchPanel(props: {
  variant: 'inline' | 'dialog';
  recents: RecentItem[];
  onGo: (target: Target) => void;
  onEscape?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}): JSX.Element;

// hooks.ts
export function useRecents(): RecentItem[]; // useSyncExternalStore over readRecentsRaw + subscribeRecents, parsed with DRUG_DB and isCalcId
export function useShortcutHint(): string;  // '⌘K' at first render and on macOS, 'Ctrl K' elsewhere after mount

// CommandPalette.tsx
export function CommandPalette(props: { open: boolean; onClose: () => void; onGo: (target: Target) => void }): JSX.Element | null;

// app/page.tsx (internal)
function go(target: Target): void;
```

- [ ] **Step 1: Write `SearchPanel`.**
  - Input: placeholder `Search any drug or calculator…`, `aria-label="Search drugs and tools"`, `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. The shortcut hint sits at the right end of the box.
  - Rows come from `searchAll(query, recents)`. State is a `PanelState`; any change of `query` resets it to `INITIAL_PANEL`.
  - Keys: ArrowDown, ArrowUp, Tab and Shift+Tab go through `panelKey`; call `preventDefault` when `handled`. In the `dialog` variant Tab never leaves the input, handled or not. Enter calls `onGo(activeTarget(...))` unless `event.nativeEvent.isComposing`. Escape calls `onEscape`.
  - `inline` variant: the list shows only while the query is non-blank and the list is open; Escape closes the list; `onGo` also clears the query. `dialog` variant: the list always shows.
  - A drug row without its own `dest` shows the three `DRUG_ACTIONS` as buttons (`tabIndex={-1}`), the active one marked. Other rows show one line. Section headings are 13px `text-slate-500`. A long `ask` title truncates with CSS.
- [ ] **Step 2: Write `CommandPalette`.** Renders nothing when closed. When open: a `fixed inset-0 z-[110]` scrim, and a centered panel (`glass-panel`, `max-w-xl`, top at about 15vh) with `role="dialog"`, `aria-modal="true"`, `aria-label="Search"`. It holds `<SearchPanel variant="dialog" autoFocus recents={useRecents()} …/>`. A click on the scrim or Escape calls `onClose`. That Escape must close nothing else: the Copilot history drawer listens for Escape in the capture phase on `window`, so while the dialog is open its Escape handler has to run first and stop the event. On open it remembers `document.activeElement`; on close it returns focus there.
- [ ] **Step 3: Wire `app/page.tsx`.**
  - State: `paletteOpen`, `pendingCalc: { id: CalcId; token: number } | null`, `pendingMixing: { drugKey: string; token: number } | null`, a `homeSearchRef`.
  - `go(target)`: closes the palette, then
    - `tool` → `setActiveTab(tab)`;
    - `calculator` → tab `calculators`, `setPendingCalc({ id, token: Date.now() })`;
    - `drug`: look the drug up in `DRUG_DB` by `id`; if it is missing, do nothing. + `mixing` → tab `mixing`, `setPendingMixing`; + `reference` → tab `drugref`, `setPendingDrug`; + `copilot` → tab `infusion`, `setPendingScenario({ scenario: `${genericName}: `, autoSubmit: false, token })`;
    - `ask` → tab `infusion`, `setPendingScenario` with the text.
    - For `drug` and `calculator` targets it calls `recordRecent`.
  - Pass `openCalc={pendingCalc}` and `openDrug={pendingMixing}`; add both to the tabs' `useMemo` deps.
  - A `keydown` listener on `window`: when `isPaletteShortcut(e)`, `preventDefault`; on the home tab focus `homeSearchRef`, elsewhere toggle `paletteOpen`.
  - Mount `<CommandPalette>` as a direct child of the root `<div>`, after `<main>`.
  - Header: build the six buttons from `TOOLS` and `TOOL_ICONS`. Each has `aria-label={label}`, `whitespace-nowrap`, the short label below `xl` and the full label from `xl` up, and its icon from `xl` up. Add a search button as the first item in the pill: `Search` icon, the word "Search" from `xl` up, the shortcut hint, `aria-label="Search drugs and tools"`; it opens the palette (or focuses `homeSearchRef` on home).
- [ ] **Step 4: Check types, lint and tests.** `npx tsc --noEmit && npx eslint app/page.tsx components/launcher && npx vitest run`. Expected: only the known `app/page.tsx` theme-effect error; all tests pass.
- [ ] **Step 5: Check in the browser** at 1024, 1280 and 1440px, both themes:
  - Cmd+K, `vanc`, Enter → the vancomycin Mixing Guide card. Cmd+K, `vanc`, Tab, Enter → the vancomycin Drug Reference monograph. Cmd+K, `vanc`, Tab, Tab, Enter → Copilot tab; after unlock the box holds `Vancomycin: `.
  - Cmd+K, `crcl`, Enter → CrCl. Pick another calculator by hand, then Cmd+K, `crcl`, Enter again → CrCl again.
  - Cmd+K, `zzqx`, Enter → Copilot question box holds `zzqx`, unsent.
  - Type in the Copilot question box, press Cmd+K, then Escape: the typed text is still there and the box has focus again.
  - Open a Drug Reference monograph, press Cmd+K: the dialog is above it; Escape closes only the dialog. Repeat with the Copilot history drawer open: Escape closes only the dialog.
  - Keyboard only: open, arrows, Tab, Enter, Escape all work; Tab never leaves the dialog.
  - At 1024px: every menu label is on one line and `document.documentElement.scrollWidth === clientWidth`. At 1280px: full labels.
- [ ] **Step 6: Commit.** `git commit -m "Add the Cmd+K search dialog and route every open request through one function"`

---

### Task 8: Launcher home page

**Files:**
- Create: `components/launcher/Launcher.tsx`
- Modify: `app/page.tsx:164-239` (replace the banner block; drop the `motion` import and unused icon imports)

**Interfaces:**
- Consumes: `SearchPanel`, `useRecents` (from `hooks.ts`), `TOOL_ICONS` (Task 7); `TOOLS`, `toolLine`, `CALCULATORS` (Task 2); `DEST_PLACE`, `Target` (Task 3).
- Produces: `export function Launcher(props: { onGo: (target: Target) => void; searchInputRef: RefObject<HTMLInputElement | null> }): JSX.Element`.

- [ ] **Step 1: Write `Launcher`.**
  - Wrapper: `pt-32 pb-16 px-6 md:px-12 max-w-5xl mx-auto w-full`, with `<h1 className="sr-only">ClinicalRx AI</h1>`.
  - `<SearchPanel variant="inline" recents={recents} inputRef={searchInputRef} autoFocus={finePointer} …/>`, where `finePointer` is `matchMedia('(pointer: fine)').matches`, read after mount.
  - Six cards from `TOOLS`: `glass-card` buttons in a grid, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Each shows its icon, `label` (16px, `text-white`) and `toolLine(tab, { drugs: DRUG_DB.length, calculators: CALCULATORS.length })` (13px, `text-slate-400`). A click calls `onGo({ kind: 'tool', tab })`.
  - Recent row, only when `useRecents()` is non-empty: the word "Recent" and up to five chips. A drug chip reads `${genericName} · ${DEST_PLACE[dest ?? 'mixing']}`; a calculator chip reads its label. A click calls `onGo` with that drug and place, or that calculator.
- [ ] **Step 2: Mount it** in the `home` block of `app/page.tsx` in place of the banner: `<Launcher onGo={go} searchInputRef={homeSearchRef} />`.
- [ ] **Step 3: Check types, lint, tests and build.** `npx tsc --noEmit && npx eslint app/page.tsx components/launcher && npx vitest run && npx next build`. Run the build only if no Next server from this repo is listening. Expected: clean apart from the known theme-effect error.
- [ ] **Step 4: Check in the browser** at 1024, 1280 and 1440px, both themes:
  - the home page shows the search box with focus, six cards with the pinned lines (12 calculators, 249 drugs) and no "Recent" row on a clean profile;
  - typing `ivig` and Enter opens the Immune Globulin IV Mixing Guide card; back on home the "Recent" row shows `Immune Globulin IV · Mixing Guide`; clicking the chip reopens it;
  - open six different items: the row shows the newest five; reload: the same five;
  - Cmd+K on home focuses the home box and opens no dialog;
  - each card opens its tool; no text on the page is under 13px.
- [ ] **Step 5: Commit.** `git commit -m "Replace the home banner with a launcher"`

---

### Task 9: Full verification and preview

- [ ] **Step 1: Run everything.** `npx vitest run && npx tsc --noEmit && npx eslint $(git diff --name-only main...HEAD -- '*.ts' '*.tsx') && npx next build`. Expected: all tests pass; lint shows only the three known errors; the build succeeds.
- [ ] **Step 2: Confirm the content rule.** `git diff --stat main...HEAD -- data/` prints nothing.
- [ ] **Step 3: Run the spec's eight browser checks** (spec section 9) locally, in both themes at 1024, 1280 and 1440px.
- [ ] **Step 4: Ask the user for the go-ahead to push** `find-it-fast`. After the push, repeat the eight checks on the Vercel preview. The Copilot's password screen needs the user to unlock the preview tab.
- [ ] **Step 5: Hand the preview to the user** for review before any merge.
