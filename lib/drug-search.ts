import { DRUG_DB } from '@/data/drug-database';
import type { Drug } from '@/lib/iv-reference-types';

// Drug search shared by the Mixing Guide and the launcher search, so abbreviations match the same way everywhere.
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Common abbreviations clinicians type that match neither generic nor brand.
export const SEARCH_ALIASES: Record<string, string> = {
  ivig: 'Immune Globulin IV', igiv: 'Immune Globulin IV',
  '5fu': 'Fluorouracil', mtx: 'Methotrexate', piptazo: 'Piperacillin/Tazobactam',
  tpa: 'Alteplase', pcc: '4-Factor PCC', '4fpcc': '4-Factor PCC', tmpsmx: 'Trimethoprim-Sulfamethoxazole',
};
export function searchDrugs(q: string, limit = 8): Drug[] {
  const n = norm(q);
  if (!n) return [];
  const aliased = new Set(Object.entries(SEARCH_ALIASES).filter(([a]) => a.startsWith(n)).map(([, g]) => g));
  const hits: { d: Drug; s: number }[] = [];
  for (const d of DRUG_DB) {
    const g = norm(d.genericName);
    const brands = d.brandName.split(/[\/,]/).map(norm).filter(Boolean);
    let s = -1;
    if (g === n || brands.includes(n) || aliased.has(d.genericName)) s = 0;
    else if (g.startsWith(n)) s = 1;
    else if (brands.some(b => b.startsWith(n))) s = 2;
    else if (g.includes(n)) s = 3;
    else if (brands.some(b => b.includes(n))) s = 4;
    if (s >= 0) hits.push({ d, s });
  }
  hits.sort((a, b) => a.s - b.s || a.d.genericName.localeCompare(b.d.genericName));
  return hits.slice(0, limit).map(h => h.d);
}
