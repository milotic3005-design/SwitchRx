import { describe, it, expect } from 'vitest';
import { copilotReducer, type CopilotAction, type CopilotState } from './state';
import type { CopilotThread, CopilotTurn } from './types';

const turn = (id: string, q = 'Vanco rate?'): CopilotTurn => ({
  id,
  question: q,
  depth: 'thorough',
  askedAt: 1,
  status: 'streaming',
  answer: '',
  followUps: [],
  supports: [],
  sources: [],
  lookup: null,
  lookupState: 'pending',
});
const empty: CopilotState = { threads: [], activeThreadId: null };

/** A state with t1 (turn a) and t2 (turn b), t1 active. */
function twoThreads(): CopilotState {
  let s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a', 'First?'), now: 1 });
  s = copilotReducer(s, { type: 'startTurn', threadId: null, newThreadId: 't2', turn: turn('b', 'Second?'), now: 2 });
  return copilotReducer(s, { type: 'openThread', threadId: 't1' });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('copilotReducer', () => {
  describe('startTurn', () => {
    it('starts a new thread titled with the question (≤ 80 chars) and opens it', () => {
      const s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a', 'x'.repeat(100)), now: 5 });
      expect(s.activeThreadId).toBe('t1');
      expect(s.threads[0]).toMatchObject({ id: 't1', title: 'x'.repeat(80), createdAt: 5, updatedAt: 5 });
      expect(s.threads[0].turns.map((t) => t.id)).toEqual(['a']);
    });

    it('puts a new thread at the front of the list', () => {
      const s = twoThreads();
      expect(s.threads.map((t) => t.id)).toEqual(['t2', 't1']);
    });

    it('collapses whitespace in the title', () => {
      const s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a', '  Vanco\n  rate?  '), now: 1 });
      expect(s.threads[0].title).toBe('Vanco rate?');
    });

    it('never cuts a surrogate pair in half when truncating the title', () => {
      const q = 'x'.repeat(79) + '\u{1F600}';
      const s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a', q), now: 1 });
      expect(s.threads[0].title).toBe('x'.repeat(79));
    });

    it('appends a turn to an existing thread, keeps its title, bumps updatedAt and opens it', () => {
      let s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a', 'First?'), now: 1 });
      s = copilotReducer(s, { type: 'newThread' });
      s = copilotReducer(s, { type: 'startTurn', threadId: 't1', newThreadId: 'unused', turn: turn('b', 'Second?'), now: 7 });
      expect(s.threads).toHaveLength(1);
      expect(s.threads[0].turns.map((t) => t.id)).toEqual(['a', 'b']);
      expect(s.threads[0]).toMatchObject({ id: 't1', title: 'First?', createdAt: 1, updatedAt: 7 });
      expect(s.activeThreadId).toBe('t1');
    });

    it('starts a new thread under newThreadId when the target thread does not exist', () => {
      const s = copilotReducer(empty, { type: 'startTurn', threadId: 'gone', newThreadId: 't9', turn: turn('a'), now: 3 });
      expect(s.threads.map((t) => t.id)).toEqual(['t9']);
      expect(s.activeThreadId).toBe('t9');
    });
  });

  describe('patchTurn', () => {
    it('patches a turn and bumps updatedAt', () => {
      const s = twoThreads();
      const next = copilotReducer(s, { type: 'patchTurn', threadId: 't1', turnId: 'a', patch: { status: 'done' }, now: 9 });
      const t1 = next.threads.find((t) => t.id === 't1')!;
      expect(t1.turns[0].status).toBe('done');
      expect(t1.updatedAt).toBe(9);
    });

    it('merges the patch into the turn and leaves other fields, turns and threads alone', () => {
      let s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a', 'First?'), now: 1 });
      s = copilotReducer(s, { type: 'startTurn', threadId: 't1', newThreadId: 'x', turn: turn('b', 'Second?'), now: 2 });
      s = copilotReducer(s, { type: 'startTurn', threadId: null, newThreadId: 't2', turn: turn('c', 'Other?'), now: 3 });
      const before = s;
      const next = copilotReducer(s, { type: 'patchTurn', threadId: 't1', turnId: 'b', patch: { answer: 'Hello', firstTokenAt: 4 }, now: 5 });
      const t1 = next.threads.find((t) => t.id === 't1')!;
      expect(t1.turns[1]).toEqual({ ...turn('b', 'Second?'), answer: 'Hello', firstTokenAt: 4 });
      expect(t1.turns[0]).toBe(before.threads.find((t) => t.id === 't1')!.turns[0]);
      expect(next.threads.find((t) => t.id === 't2')).toBe(before.threads.find((t) => t.id === 't2'));
      expect(next.activeThreadId).toBe(before.activeThreadId);
    });

    it('ignores patches for a missing thread or turn', () => {
      const s = copilotReducer(empty, { type: 'startTurn', threadId: null, newThreadId: 't1', turn: turn('a'), now: 1 });
      expect(copilotReducer(s, { type: 'patchTurn', threadId: 'gone', turnId: 'a', patch: { answer: 'x' }, now: 2 })).toBe(s);
      expect(copilotReducer(s, { type: 'patchTurn', threadId: 't1', turnId: 'gone', patch: { answer: 'x' }, now: 2 })).toBe(s);
    });

    it('ignores a late patch for a thread that was deleted', () => {
      const s = copilotReducer(twoThreads(), { type: 'deleteThread', threadId: 't1' });
      expect(copilotReducer(s, { type: 'patchTurn', threadId: 't1', turnId: 'a', patch: { answer: 'late' }, now: 9 })).toBe(s);
    });

    it('ignores a late patch after the history was cleared', () => {
      const s = copilotReducer(twoThreads(), { type: 'clearAll' });
      expect(copilotReducer(s, { type: 'patchTurn', threadId: 't2', turnId: 'b', patch: { answer: 'late' }, now: 9 })).toBe(s);
    });

    it('never writes a turn into a different thread than the one it names', () => {
      const s = twoThreads();
      // Turn b belongs to t2; naming t1 must not reach it.
      expect(copilotReducer(s, { type: 'patchTurn', threadId: 't1', turnId: 'b', patch: { answer: 'x' }, now: 9 })).toBe(s);
    });
  });

  describe('deleteThread', () => {
    it('returns home after deleting the active thread', () => {
      const s = copilotReducer(twoThreads(), { type: 'deleteThread', threadId: 't1' });
      expect(s.activeThreadId).toBeNull();
      expect(s.threads.map((t) => t.id)).toEqual(['t2']);
    });

    it('keeps the active thread when another one is deleted', () => {
      const s = copilotReducer(twoThreads(), { type: 'deleteThread', threadId: 't2' });
      expect(s.activeThreadId).toBe('t1');
      expect(s.threads.map((t) => t.id)).toEqual(['t1']);
    });

    it('is a no-op for an unknown thread', () => {
      const s = twoThreads();
      expect(copilotReducer(s, { type: 'deleteThread', threadId: 'gone' })).toBe(s);
    });
  });

  describe('clearAll', () => {
    it('clears all threads and returns home', () => {
      const s = copilotReducer(twoThreads(), { type: 'clearAll' });
      expect(s).toEqual({ threads: [], activeThreadId: null });
    });
  });

  describe('openThread / newThread', () => {
    it('opens a thread and starts a new question', () => {
      let s = copilotReducer(twoThreads(), { type: 'openThread', threadId: 't2' });
      expect(s.activeThreadId).toBe('t2');
      s = copilotReducer(s, { type: 'newThread' });
      expect(s.activeThreadId).toBeNull();
      expect(s.threads.map((t) => t.id)).toEqual(['t2', 't1']);
    });

    it('does not open a thread that does not exist', () => {
      const s = twoThreads();
      expect(copilotReducer(s, { type: 'openThread', threadId: 'gone' })).toBe(s);
    });
  });

  describe('load', () => {
    const saved: CopilotThread[] = [
      { id: 's1', title: 'Saved', createdAt: 1, updatedAt: 2, turns: [{ ...turn('z'), status: 'done', answer: 'A' }] },
    ];

    it('replaces the threads', () => {
      const s = copilotReducer(empty, { type: 'load', threads: saved });
      expect(s).toEqual({ threads: saved, activeThreadId: null });
    });

    it('keeps the active thread only if it is still present', () => {
      const withActive: CopilotState = { threads: saved, activeThreadId: 's1' };
      expect(copilotReducer(withActive, { type: 'load', threads: saved }).activeThreadId).toBe('s1');
      expect(copilotReducer(twoThreads(), { type: 'load', threads: saved }).activeThreadId).toBeNull();
    });
  });

  it('never mutates its input state or action', () => {
    const s = deepFreeze(twoThreads());
    const actions: CopilotAction[] = [
      { type: 'startTurn', threadId: 't1', newThreadId: 'n', turn: turn('c'), now: 3 },
      { type: 'startTurn', threadId: null, newThreadId: 'n', turn: turn('c'), now: 3 },
      { type: 'patchTurn', threadId: 't1', turnId: 'a', patch: { answer: 'x', followUps: ['q'] }, now: 4 },
      { type: 'openThread', threadId: 't2' },
      { type: 'newThread' },
      { type: 'deleteThread', threadId: 't1' },
      { type: 'clearAll' },
      { type: 'load', threads: [] },
    ];
    for (const action of actions) {
      expect(() => copilotReducer(s, deepFreeze(structuredClone(action)))).not.toThrow();
    }
    expect(s.threads.map((t) => t.id)).toEqual(['t2', 't1']);
  });
});
