import { describe, it, expect } from 'vitest';
import { DRUG_DB } from '@/data/drug-database';
import { rowTarget, searchAll, type RecentItem } from './search';

const heads = (q: string, r: RecentItem[] = []) => searchAll(q, r).map(s => s.heading);
const titles = (q: string, heading: string) =>
  searchAll(q, []).find(s => s.heading === heading)?.rows.map(r => r.title) ?? [];

describe('searchAll', () => {
  it('lists drugs, then calculators, then tools', () => {
    expect(heads('vanc')).toEqual(['Drugs', 'Calculators']);
    expect(titles('vanc', 'Drugs')[0]).toBe('Vancomycin');
    expect(titles('vanc', 'Calculators')).toEqual(['Vancomycin AUC Dosing']);
  });

  it('finds calculators by keyword', () => {
    expect(titles('ibw', 'Calculators')).toEqual(['Body Weight & BMI']);
    expect(titles('creatinine', 'Calculators')).toEqual(['CrCl (Cockcroft-Gault)']);
  });

  it('finds tools by name', () => {
    expect(titles('mixing', 'Tools')).toEqual(['Mixing Guide']);
  });

  it('caps each section', () => {
    const s = searchAll('a', []);
    expect(s.find(x => x.heading === 'Drugs')!.rows.length).toBeLessThanOrEqual(6);
    expect(s.find(x => x.heading === 'Calculators')?.rows.length ?? 0).toBeLessThanOrEqual(4);
    expect(s.find(x => x.heading === 'Tools')?.rows.length ?? 0).toBeLessThanOrEqual(3);
  });

  it('ignores case, spaces and punctuation', () => {
    expect(searchAll('  CrCl ', [])).toEqual(searchAll('crcl', []));
  });

  it('offers the Copilot when nothing matches, with the literal text', () => {
    const [section] = searchAll('  <b>"zzqx"</b> ', []);
    expect(section.heading).toBeNull();
    expect(section.rows).toEqual([
      { kind: 'ask', key: 'ask', text: '<b>"zzqx"</b>', title: 'Ask Infusion Copilot about “<b>"zzqx"</b>”' },
    ]);
  });

  it('treats a blank query as empty: recents, then all six tools', () => {
    expect(heads('   ')).toEqual(['Tools']);
    expect(searchAll('', [])[0].rows).toHaveLength(6);
    const recents: RecentItem[] = [
      { kind: 'drug', id: DRUG_DB[0].id, dest: 'reference' },
      { kind: 'calculator', id: 'crcl' },
    ];
    const [recent, tools] = searchAll('', recents);
    expect(recent.heading).toBe('Recent');
    expect(recent.rows[0]).toMatchObject({
      kind: 'drug',
      title: DRUG_DB[0].genericName,
      subtitle: 'Drug Reference',
      dest: 'reference',
    });
    expect(recent.rows[1]).toMatchObject({ kind: 'calculator', id: 'crcl' });
    expect(tools.heading).toBe('Tools');
    expect(heads('', [{ kind: 'drug', id: 'nope', dest: 'mixing' }, { kind: 'calculator', id: 'old' }])).toEqual(['Tools']);
  });
});

describe('rowTarget', () => {
  it('turns a row and an action into a target', () => {
    const drug = searchAll('vancomycin', [])[0].rows[0];
    expect(rowTarget(drug)).toMatchObject({ kind: 'drug', dest: 'mixing' });
    expect(rowTarget(drug, 1)).toMatchObject({ kind: 'drug', dest: 'reference' });
    expect(rowTarget(drug, 2)).toMatchObject({ kind: 'drug', dest: 'copilot' });
    const recentDrug = searchAll('', [{ kind: 'drug', id: DRUG_DB[0].id, dest: 'reference' }])[0].rows[0];
    expect(rowTarget(recentDrug, 0)).toMatchObject({ dest: 'reference' });
  });

  it('opens a calculator, a tool, or the Copilot with the text', () => {
    expect(rowTarget(searchAll('crcl', [])[0].rows[0])).toEqual({ kind: 'calculator', id: 'crcl' });
    expect(rowTarget(searchAll('mixing', []).find(s => s.heading === 'Tools')!.rows[0])).toEqual({ kind: 'tool', tab: 'mixing' });
    expect(rowTarget(searchAll('zzqx', [])[0].rows[0])).toEqual({ kind: 'ask', text: 'zzqx' });
  });
});
