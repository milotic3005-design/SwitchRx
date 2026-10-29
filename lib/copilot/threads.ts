import type { CopilotThread, CopilotTurn, TurnStatus } from './types';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const THREADS_KEY = 'switchrx.copilot.threads.v1';
export const MAX_THREADS = 50;

const STORAGE_VERSION = 1;

/** Turns still in flight are never saved: nothing would be running them after a reload. */
const PERSISTED_STATUSES: ReadonlySet<TurnStatus> = new Set<TurnStatus>(['done', 'stopped', 'error']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTurnShape(value: unknown): value is CopilotTurn {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.question === 'string' &&
    (value.depth === 'quick' || value.depth === 'thorough') &&
    typeof value.askedAt === 'number' &&
    typeof value.status === 'string' &&
    typeof value.answer === 'string' &&
    Array.isArray(value.followUps) &&
    Array.isArray(value.supports) &&
    Array.isArray(value.sources)
  );
}

function isThreadShape(value: unknown): value is CopilotThread {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Number.isFinite(value.createdAt) &&
    Number.isFinite(value.updatedAt) &&
    Array.isArray(value.turns)
  );
}

/**
 * What may be stored: only finished turns, no thread left empty, the
 * MAX_THREADS most recently updated threads, newest first. Never mutates `threads`.
 */
function toPersistable(threads: CopilotThread[]): CopilotThread[] {
  return threads
    .map((t) => ({ ...t, turns: t.turns.filter((turn) => PERSISTED_STATUSES.has(turn.status)) }))
    .filter((t) => t.turns.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS);
}

/** Reads saved threads. Never throws: anything missing, unreadable or malformed yields fewer threads, or []. */
export function loadThreads(storage: StorageLike | null): CopilotThread[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(THREADS_KEY);
    if (raw === null) return [];
    const payload: unknown = JSON.parse(raw);
    if (!isRecord(payload) || payload.version !== STORAGE_VERSION || !Array.isArray(payload.threads)) return [];
    const threads = payload.threads
      .filter(isThreadShape)
      .map((t) => ({ ...t, turns: t.turns.filter(isTurnShape) }));
    // Same rules as saving, so stale or hand-edited data cannot bring back a "running" turn.
    return toPersistable(threads);
  } catch {
    return [];
  }
}

/**
 * Saves finished turns of the most recent threads. An empty result removes the
 * stored entry. Returns 'unavailable' when there is no storage or it refuses the write.
 */
export function saveThreads(storage: StorageLike | null, threads: CopilotThread[]): 'ok' | 'unavailable' {
  if (!storage) return 'unavailable';
  try {
    const persistable = toPersistable(threads);
    if (persistable.length === 0) storage.removeItem(THREADS_KEY);
    else storage.setItem(THREADS_KEY, JSON.stringify({ version: STORAGE_VERSION, threads: persistable }));
    return 'ok';
  } catch {
    return 'unavailable';
  }
}
