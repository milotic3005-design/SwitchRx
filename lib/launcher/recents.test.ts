import { describe, it, expect } from 'vitest';
import { addRecent, parseRecents, readRecentsRaw, recordRecent } from './recents';
import type { RecentItem } from './search';

const known = { hasDrug: (id: string) => id !== 'gone', hasCalc: (id: string) => id === 'crcl' || id === 'cadd' };

describe('addRecent', () => {
  it('puts the newest first and keeps one entry per item, with the newest place', () => {
    let list = addRecent([], { kind: 'drug', id: 'a1', dest: 'mixing' });
    list = addRecent(list, { kind: 'calculator', id: 'crcl' });
    list = addRecent(list, { kind: 'drug', id: 'a1', dest: 'reference' });
    expect(list).toEqual([
      { kind: 'drug', id: 'a1', dest: 'reference' },
      { kind: 'calculator', id: 'crcl' },
    ]);
  });

  it('caps the list at five', () => {
    let list: RecentItem[] = [];
    for (let i = 0; i < 7; i++) list = addRecent(list, { kind: 'drug', id: `d${i}`, dest: 'mixing' });
    expect(list.map(x => x.id)).toEqual(['d6', 'd5', 'd4', 'd3', 'd2']);
  });
});

describe('parseRecents', () => {
  it('drops unknown ids and survives bad stored data', () => {
    const raw = JSON.stringify([
      { kind: 'drug', id: 'gone', dest: 'mixing' },
      { kind: 'calculator', id: 'crcl' },
      { kind: 'calculator', id: 'old' },
    ]);
    expect(parseRecents(raw, known)).toEqual([{ kind: 'calculator', id: 'crcl' }]);
    for (const bad of [
      null,
      '',
      '{',
      '{"a":1}',
      '[1,"x",null]',
      '[{"kind":"drug"}]',
      '[{"kind":"drug","id":"a1","dest":"elsewhere"}]',
    ])
      expect(parseRecents(bad, known), String(bad)).toEqual([]);
  });

  it('keeps a stored drug with a known place', () => {
    const raw = JSON.stringify([{ kind: 'drug', id: 'a1', dest: 'copilot', extra: 'ignored' }]);
    expect(parseRecents(raw, known)).toEqual([{ kind: 'drug', id: 'a1', dest: 'copilot' }]);
  });
});

describe('recordRecent', () => {
  it('records through a store and tolerates one that throws', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    recordRecent({ kind: 'calculator', id: 'crcl' }, store);
    recordRecent({ kind: 'calculator', id: 'cadd' }, store);
    expect(parseRecents(readRecentsRaw(store), known).map(x => x.id)).toEqual(['cadd', 'crcl']);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(() => recordRecent({ kind: 'calculator', id: 'crcl' }, broken)).not.toThrow();
  });

  it('keeps the list until the page reloads when storage is blocked or full', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readRecentsRaw(blocked)).toBeNull();
    recordRecent({ kind: 'calculator', id: 'crcl' }, blocked);
    recordRecent({ kind: 'calculator', id: 'cadd' }, blocked);
    expect(parseRecents(readRecentsRaw(blocked), known).map(x => x.id)).toEqual(['cadd', 'crcl']);

    // Full: reads still work, writes fail. What was stored before stays, with the new item in front.
    const full = {
      getItem: () => JSON.stringify([{ kind: 'calculator', id: 'crcl' }]),
      setItem: () => {
        throw new Error('full');
      },
    };
    recordRecent({ kind: 'calculator', id: 'cadd' }, full);
    expect(parseRecents(readRecentsRaw(full), known).map(x => x.id)).toEqual(['cadd', 'crcl']);

    // Another store is unaffected.
    const empty = { getItem: () => null, setItem: () => {} };
    expect(readRecentsRaw(empty)).toBeNull();
  });
});
