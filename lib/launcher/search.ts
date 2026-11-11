import { DRUG_DB } from '@/data/drug-database';
import { norm, searchDrugs } from '@/lib/drug-search';
import type { Drug } from '@/lib/iv-reference-types';
import { CALC_GROUPS, CALCULATORS, TOOLS, isCalcId, type CalcId, type TabId } from './catalog';

/** Where a drug can be opened from the search. */
export type DrugDest = 'mixing' | 'reference' | 'copilot';

/** A place the app can go: what `go(target)` in `app/page.tsx` accepts. */
export type Target =
  | { kind: 'tool'; tab: TabId }
  | { kind: 'calculator'; id: CalcId }
  | { kind: 'drug'; id: string; dest: DrugDest }
  | { kind: 'ask'; text: string };

/** A drug or calculator opened recently. `dest` is where the drug was opened. */
export interface RecentItem {
  kind: 'drug' | 'calculator';
  id: string;
  dest?: DrugDest;
}

/** The three actions on a drug row, in Tab order. The first is what Enter runs. */
export const DRUG_ACTIONS: readonly { dest: DrugDest; label: string }[] = [
  { dest: 'mixing', label: 'Mixing Guide' },
  { dest: 'reference', label: 'Drug Reference' },
  { dest: 'copilot', label: 'Ask Copilot' },
];

/** The name of the place a drug was opened, as shown on a recent item. */
export const DEST_PLACE: Record<DrugDest, string> = {
  mixing: 'Mixing Guide',
  reference: 'Drug Reference',
  copilot: 'Infusion Copilot',
};

/** One result. A drug row with its own `dest` (a recent item) has that single action instead of the three. */
export type ResultRow =
  | { kind: 'drug'; key: string; id: string; title: string; subtitle: string; dest?: DrugDest }
  | { kind: 'calculator'; key: string; id: CalcId; title: string; subtitle: string }
  | { kind: 'tool'; key: string; tab: TabId; title: string }
  | { kind: 'ask'; key: string; text: string; title: string };

export interface ResultSection {
  heading: 'Recent' | 'Drugs' | 'Calculators' | 'Tools' | null;
  rows: ResultRow[];
}

const MAX_DRUGS = 6;
const MAX_CALCULATORS = 4;
const MAX_TOOLS = 3;

const groupLabel = (id: string): string => CALC_GROUPS.find(g => g.id === id)?.label ?? '';

const words = (label: string): string[] => label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** How well `n` (already normalised) matches a label and its keywords: 1 is best, 0 is no match. */
function score(n: string, label: string, keywords: readonly string[] = []): number {
  const full = norm(label);
  const keys = keywords.map(norm);
  if (full.startsWith(n)) return 1;
  if (words(label).some(w => w.startsWith(n)) || keys.some(k => k.startsWith(n))) return 2;
  if (full.includes(n)) return 3;
  if (keys.some(k => k.includes(n))) return 4;
  return 0;
}

/**
 * How well a typed query matches: the whole query as one word first ("crcl", "5-FU"), and failing that,
 * every word of it in any order ("vanco auc"), which ranks after any whole-query match.
 */
function matchScore(query: string, label: string, keywords: readonly string[] = []): number {
  const whole = score(norm(query), label, keywords);
  if (whole > 0) return whole;
  const parts = words(query);
  if (parts.length < 2) return 0;
  const each = parts.map(part => score(part, label, keywords));
  return each.every(s => s > 0) ? 4 + Math.max(...each) : 0;
}

const GENERIC_COUNT = DRUG_DB.reduce(
  (counts, d) => counts.set(d.genericName, (counts.get(d.genericName) ?? 0) + 1),
  new Map<string, number>(),
);

/**
 * A drug's name where no brand is shown beside it (a recent item): the generic name, with the brand added
 * when two products share it, such as Denosumab (Prolia) and Denosumab (Xgeva).
 */
export function recentDrugName(drug: Drug): string {
  return (GENERIC_COUNT.get(drug.genericName) ?? 0) > 1 ? `${drug.genericName} (${drug.brandName})` : drug.genericName;
}

/** The best `limit` matches, best score first; ties keep the catalog's order. */
function best<T>(items: readonly T[], limit: number, of: (item: T) => number): T[] {
  return items
    .map((item, i) => ({ item, i, s: of(item) }))
    .filter(x => x.s > 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, limit)
    .map(x => x.item);
}

const toolRow = (tool: (typeof TOOLS)[number]): ResultRow => ({ kind: 'tool', key: `tool:${tool.tab}`, tab: tool.tab, title: tool.label });

const calculatorRow = (calc: (typeof CALCULATORS)[number]): ResultRow => ({
  kind: 'calculator',
  key: `calc:${calc.id}`,
  id: calc.id,
  title: calc.label,
  subtitle: groupLabel(calc.group),
});

/** A recent item as a row, or nothing when its drug or calculator no longer exists. */
function recentRow(item: RecentItem): ResultRow[] {
  if (item.kind === 'calculator') {
    const calc = isCalcId(item.id) ? CALCULATORS.find(c => c.id === item.id) : undefined;
    return calc ? [calculatorRow(calc)] : [];
  }
  const drug = DRUG_DB.find(d => d.id === item.id);
  if (!drug) return [];
  const dest = item.dest ?? 'mixing';
  return [{ kind: 'drug', key: `drug:${drug.id}`, id: drug.id, title: recentDrugName(drug), subtitle: DEST_PLACE[dest], dest }];
}

/**
 * The search results for `query`, in sections. A typed query gives Drugs, Calculators and Tools (empty
 * sections left out), or a single row offering the Copilot when nothing matches. An empty or blank query
 * gives the recent items, then every tool.
 */
export function searchAll(query: string, recents: RecentItem[]): ResultSection[] {
  const n = norm(query);
  if (!n) {
    const recentRows = recents.flatMap(recentRow);
    return [
      ...(recentRows.length > 0 ? [{ heading: 'Recent' as const, rows: recentRows }] : []),
      { heading: 'Tools' as const, rows: TOOLS.map(toolRow) },
    ];
  }

  const drugs: ResultRow[] = searchDrugs(query, MAX_DRUGS).map(d => ({
    kind: 'drug',
    key: `drug:${d.id}`,
    id: d.id,
    title: d.genericName,
    subtitle: d.brandName,
  }));
  const calculators = best(CALCULATORS, MAX_CALCULATORS, c => matchScore(query, c.label, c.keywords)).map(calculatorRow);
  const tools = best(TOOLS, MAX_TOOLS, t => matchScore(query, t.label)).map(toolRow);

  const sections: ResultSection[] = [
    { heading: 'Drugs' as const, rows: drugs },
    { heading: 'Calculators' as const, rows: calculators },
    { heading: 'Tools' as const, rows: tools },
  ].filter(s => s.rows.length > 0);
  if (sections.length > 0) return sections;

  const text = query.trim();
  return [{ heading: null, rows: [{ kind: 'ask', key: 'ask', text, title: `Ask Infusion Copilot about “${text}”` }] }];
}

/** Where a row leads. `action` picks one of a drug row's three actions; a row with its own place ignores it. */
export function rowTarget(row: ResultRow, action = 0): Target {
  switch (row.kind) {
    case 'drug':
      return { kind: 'drug', id: row.id, dest: row.dest ?? DRUG_ACTIONS[action]?.dest ?? DRUG_ACTIONS[0].dest };
    case 'calculator':
      return { kind: 'calculator', id: row.id };
    case 'tool':
      return { kind: 'tool', tab: row.tab };
    case 'ask':
      return { kind: 'ask', text: row.text };
  }
}
