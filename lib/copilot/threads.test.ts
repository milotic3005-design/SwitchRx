import { describe, it, expect } from 'vitest';
import { loadThreads, saveThreads, THREADS_KEY, MAX_THREADS, type StorageLike } from './threads';
import type { CopilotThread, CopilotTurn, TurnStatus } from './types';

class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** Storage whose writes fail (quota exceeded / blocked). */
class FailingStorage extends MemoryStorage {
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

/** Storage whose reads fail (access denied). */
class UnreadableStorage extends MemoryStorage {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
}

const turnWith = (id: string, status: TurnStatus): CopilotTurn => ({
  id,
  question: `Question ${id}?`,
  depth: 'thorough',
  askedAt: 1,
  status,
  answer: 'An answer.',
  followUps: ['Next?'],
  supports: [{ text: 'An answer.', sourceIndices: [0] }],
  sources: [],
  lookup: null,
  lookupState: 'ok',
});
const done = (id: string) => turnWith(id, 'done');
const thread = (id: string, turns: CopilotTurn[], updatedAt = 1): CopilotThread => ({
  id,
  title: `Thread ${id}`,
  createdAt: 1,
  updatedAt,
  turns,
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('saveThreads / loadThreads', () => {
  it('uses the v1 key and a cap of 50', () => {
    expect(THREADS_KEY).toBe('switchrx.copilot.threads.v1');
    expect(MAX_THREADS).toBe(50);
  });

  it('round-trips completed turns under the v1 key', () => {
    const m = new MemoryStorage();
    expect(saveThreads(m, [thread('t1', [done('a')])])).toBe('ok');
    expect(JSON.parse(m.getItem('switchrx.copilot.threads.v1')!).version).toBe(1);
    expect(loadThreads(m)).toEqual([thread('t1', [done('a')])]);
  });

  it('keeps stopped and errored turns', () => {
    const m = new MemoryStorage();
    const t = thread('t1', [turnWith('a', 'done'), turnWith('b', 'stopped'), { ...turnWith('c', 'error'), error: 'boom' }]);
    saveThreads(m, [t]);
    expect(loadThreads(m)).toEqual([t]);
  });

  it('does not persist running turns and drops threads left empty', () => {
    const m = new MemoryStorage();
    const mixed = thread('t1', [done('a'), turnWith('b', 'lookup'), turnWith('c', 'streaming'), turnWith('d', 'resolving')]);
    const onlyRunning = thread('t2', [turnWith('e', 'streaming')]);
    expect(saveThreads(m, [mixed, onlyRunning])).toBe('ok');
    const stored = JSON.parse(m.getItem(THREADS_KEY)!);
    expect(stored.threads.map((t: CopilotThread) => t.id)).toEqual(['t1']);
    expect(stored.threads[0].turns.map((t: CopilotTurn) => t.id)).toEqual(['a']);
    expect(loadThreads(m)).toEqual([thread('t1', [done('a')])]);
  });

  it('keeps only the 50 most recently updated threads', () => {
    const m = new MemoryStorage();
    const all = Array.from({ length: 55 }, (_, i) => thread(`t${i + 1}`, [done(`a${i + 1}`)], i + 1));
    expect(saveThreads(m, all)).toBe('ok');
    const loaded = loadThreads(m);
    expect(loaded).toHaveLength(50);
    // updatedAt 1..5 are the oldest and are dropped; most recent comes first.
    expect(loaded.map((t) => t.updatedAt)).toEqual(Array.from({ length: 50 }, (_, i) => 55 - i));
    expect(loaded.some((t) => t.id === 't5')).toBe(false);
    expect(loaded.some((t) => t.id === 't6')).toBe(true);
  });

  it('does not mutate the threads it is given', () => {
    const m = new MemoryStorage();
    const input = deepFreeze([thread('t1', [done('a'), turnWith('b', 'streaming')], 1), thread('t2', [done('c')], 2)]);
    expect(saveThreads(m, input)).toBe('ok');
    expect(input.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(input[0].turns).toHaveLength(2);
  });

  it('removes the stored entry when nothing is left to persist', () => {
    const m = new MemoryStorage();
    saveThreads(m, [thread('t1', [done('a')])]);
    expect(m.getItem(THREADS_KEY)).not.toBeNull();
    expect(saveThreads(m, [])).toBe('ok');
    expect(m.getItem(THREADS_KEY)).toBeNull();
    saveThreads(m, [thread('t1', [done('a')])]);
    expect(saveThreads(m, [thread('t2', [turnWith('b', 'streaming')])])).toBe('ok');
    expect(m.getItem(THREADS_KEY)).toBeNull();
  });

  it('returns [] for corrupt JSON, a wrong version, or non-array threads', () => {
    const m = new MemoryStorage();
    m.setItem(THREADS_KEY, '{not json');
    expect(loadThreads(m)).toEqual([]);
    m.setItem(THREADS_KEY, JSON.stringify({ version: 2, threads: [thread('t1', [done('a')])] }));
    expect(loadThreads(m)).toEqual([]);
    m.setItem(THREADS_KEY, JSON.stringify({ version: 1, threads: { t1: 'nope' } }));
    expect(loadThreads(m)).toEqual([]);
  });

  it('returns [] when there is nothing stored, the payload is not an object, or storage is missing or unreadable', () => {
    expect(loadThreads(new MemoryStorage())).toEqual([]);
    expect(loadThreads(null)).toEqual([]);
    expect(loadThreads(new UnreadableStorage())).toEqual([]);
    const m = new MemoryStorage();
    for (const raw of ['null', '[]', '"x"', '7']) {
      m.setItem(THREADS_KEY, raw);
      expect(loadThreads(m)).toEqual([]);
    }
  });

  it('drops malformed threads and turns instead of returning them', () => {
    const m = new MemoryStorage();
    const good = thread('good', [done('a')], 5);
    // Deliberately malformed, so typed loosely.
    const badTurnShape: unknown = { ...done('b'), followUps: 'not an array' };
    const withTurns = (id: string, turns: unknown[], updatedAt: number): unknown => ({ ...thread(id, [], updatedAt), turns });
    m.setItem(
      THREADS_KEY,
      JSON.stringify({
        version: 1,
        threads: [
          null,
          'str',
          { id: 'no-turns', title: 'x', createdAt: 1, updatedAt: 1 },
          { ...thread('bad-time', [done('c')]), updatedAt: 'yesterday' },
          withTurns('mixed', [done('d'), badTurnShape, null, 3], 4),
          withTurns('all-bad', [badTurnShape], 3),
          good,
        ],
      }),
    );
    expect(loadThreads(m)).toEqual([good, thread('mixed', [done('d')], 4)]);
  });

  it('does not resurrect a running turn from stored data', () => {
    const m = new MemoryStorage();
    const stale = thread('t1', [done('a'), turnWith('b', 'streaming')]);
    m.setItem(THREADS_KEY, JSON.stringify({ version: 1, threads: [stale, thread('t2', [turnWith('c', 'lookup')])] }));
    expect(loadThreads(m)).toEqual([thread('t1', [done('a')])]);
  });

  it('reports unavailable when storage is missing or setItem throws', () => {
    expect(saveThreads(null, [])).toBe('unavailable');
    expect(saveThreads(new FailingStorage(), [thread('t1', [done('a')])])).toBe('unavailable');
  });
});
