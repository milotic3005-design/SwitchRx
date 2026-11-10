import { describe, it, expect } from 'vitest';
import { CALC_GROUPS, CALCULATORS, DEFAULT_CALC, TOOLS, isCalcId, toolLine } from './catalog';

describe('catalog', () => {
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
    expect(CALC_GROUPS).toHaveLength(4);
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
});
