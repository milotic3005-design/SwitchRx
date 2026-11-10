import { describe, it, expect } from 'vitest';
import { searchDrugs } from './drug-search';

const names = (q: string, limit?: number) => searchDrugs(q, limit).map(d => d.genericName);

describe('searchDrugs', () => {
  it('ranks an exact generic match first', () => {
    expect(names('vancomycin')[0]).toBe('Vancomycin');
  });

  it('matches a brand name', () => {
    expect(names('remicade')).toContain('Infliximab');
  });

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

  it('caps the list', () => {
    expect(searchDrugs('a', 3)).toHaveLength(3);
  });
});
