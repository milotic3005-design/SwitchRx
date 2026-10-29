import { describe, it, expect } from 'vitest';
import { SourceCollector, SupportCollector, mapSupports } from './grounding';

describe('SourceCollector', () => {
  it('returns stable indices for duplicate sources', () => {
    const c = new SourceCollector();
    expect([c.add('u1', 'A'), c.add('u2', 'B'), c.add('u1', 'a')]).toEqual([0, 1, 0]);
  });

  it('returns -1 and adds nothing when there is no uri', () => {
    const c = new SourceCollector();
    expect([c.add(undefined, 'A'), c.add(null, 'B'), c.add('', 'C')]).toEqual([-1, -1, -1]);
    expect(c.list()).toEqual([]);
    expect(c.changed()).toBe(false);
  });

  it('falls back to the uri as title and reports changes once', () => {
    const c = new SourceCollector();
    c.add('u1', '  ');
    expect(c.list()).toEqual([{ uri: 'u1', title: 'u1' }]);
    expect(c.changed()).toBe(true);
    expect(c.changed()).toBe(false);
    c.add('u1', ' ');
    expect(c.changed()).toBe(false);
    c.add('u2', 'B');
    expect(c.changed()).toBe(true);
  });
});

describe('mapSupports', () => {
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

  it('resolves retrievedContext chunks the same way the sources list does', () => {
    const c = new SourceCollector();
    c.add('uR', 'Ctx');
    expect(mapSupports({
      groundingChunks: [{ retrievedContext: { uri: 'uR', title: 'Ctx' } }, { web: { uri: 'uW', title: 'Web' } }],
      groundingSupports: [{ segment: { text: 'Y.' }, groundingChunkIndices: [1, 0] }],
    }, c)).toEqual([{ text: 'Y.', sourceIndices: [1, 0] }]);
  });

  it('skips chunks that have no uri and tolerates missing fields', () => {
    const c = new SourceCollector();
    expect(mapSupports({
      groundingChunks: [{ web: { title: 'No uri' } }, {}, { web: { uri: 'uA', title: 'A' } }],
      groundingSupports: [{ segment: { text: 'Z.' }, groundingChunkIndices: [0, 1, 2] }, { segment: { text: 'No indices.' } }],
    }, c)).toEqual([{ text: 'Z.', sourceIndices: [0] }]);
    expect(mapSupports({}, c)).toEqual([]);
  });
});

describe('SupportCollector', () => {
  it('accumulates supports across chunks, de-duplicated by text', () => {
    const s = new SupportCollector();
    expect(s.add([{ text: 'A.', sourceIndices: [0] }])).toBe(true);
    expect(s.add([{ text: 'A.', sourceIndices: [0] }])).toBe(false);
    expect(s.list()).toHaveLength(1);
  });

  it('reports a change when any new text arrives and keeps first-seen order', () => {
    const s = new SupportCollector();
    s.add([{ text: 'A.', sourceIndices: [0] }]);
    expect(s.add([{ text: 'A.', sourceIndices: [0] }, { text: 'B.', sourceIndices: [1] }])).toBe(true);
    expect(s.list()).toEqual([{ text: 'A.', sourceIndices: [0] }, { text: 'B.', sourceIndices: [1] }]);
  });
});
