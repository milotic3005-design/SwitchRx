import type { CopilotThread, CopilotTurn, TurnPatch } from './types';

export interface CopilotState {
  threads: CopilotThread[];
  /** The open thread, or null on the home screen. */
  activeThreadId: string | null;
}

export type CopilotAction =
  | { type: 'load'; threads: CopilotThread[] }
  | { type: 'newThread' }
  | { type: 'openThread'; threadId: string }
  | { type: 'startTurn'; threadId: string | null; newThreadId: string; turn: CopilotTurn; now: number }
  | { type: 'patchTurn'; threadId: string; turnId: string; patch: TurnPatch; now: number }
  | { type: 'deleteThread'; threadId: string }
  | { type: 'clearAll' };

const MAX_TITLE_LENGTH = 80;

/** A single-line thread title of at most 80 characters, taken from the first question. */
function titleFrom(question: string): string {
  const text = question.replace(/\s+/g, ' ').trim();
  let title = text.slice(0, MAX_TITLE_LENGTH);
  // Truncating by UTF-16 unit can strand half of a surrogate pair at the cut.
  if (title.length < text.length && /[\uD800-\uDBFF]$/.test(title)) title = title.slice(0, -1);
  return title.trimEnd();
}

/**
 * Pure state for the saved-threads UI. Every action returns a new state without
 * touching its input; the one exception is that actions which would change
 * nothing return the same `state` object. In particular a `patchTurn` for a
 * thread or turn that no longer exists (deleted, cleared, never created) is such
 * a no-op, so a late update from a still-running answer can never write into
 * another thread.
 */
export function copilotReducer(state: CopilotState, action: CopilotAction): CopilotState {
  switch (action.type) {
    case 'load': {
      // Keep the open thread only if it survived the reload.
      const stillOpen = action.threads.some((t) => t.id === state.activeThreadId);
      return { threads: action.threads, activeThreadId: stillOpen ? state.activeThreadId : null };
    }

    case 'newThread':
      return state.activeThreadId === null ? state : { ...state, activeThreadId: null };

    case 'openThread': {
      if (!state.threads.some((t) => t.id === action.threadId)) return state;
      return state.activeThreadId === action.threadId ? state : { ...state, activeThreadId: action.threadId };
    }

    case 'startTurn': {
      const { threadId, newThreadId, turn, now } = action;
      if (threadId !== null && state.threads.some((t) => t.id === threadId)) {
        return {
          threads: state.threads.map((t) => (t.id === threadId ? { ...t, updatedAt: now, turns: [...t.turns, turn] } : t)),
          activeThreadId: threadId,
        };
      }
      // A null (or no longer existing) target starts a new thread, newest first.
      const created: CopilotThread = {
        id: newThreadId,
        title: titleFrom(turn.question),
        createdAt: now,
        updatedAt: now,
        turns: [turn],
      };
      return { threads: [created, ...state.threads], activeThreadId: newThreadId };
    }

    case 'patchTurn': {
      const { threadId, turnId, patch, now } = action;
      const thread = state.threads.find((t) => t.id === threadId);
      if (!thread || !thread.turns.some((t) => t.id === turnId)) return state;
      const updated: CopilotThread = {
        ...thread,
        updatedAt: now,
        turns: thread.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)),
      };
      return { ...state, threads: state.threads.map((t) => (t.id === threadId ? updated : t)) };
    }

    case 'deleteThread': {
      if (!state.threads.some((t) => t.id === action.threadId)) return state;
      return {
        threads: state.threads.filter((t) => t.id !== action.threadId),
        activeThreadId: state.activeThreadId === action.threadId ? null : state.activeThreadId,
      };
    }

    case 'clearAll':
      return { threads: [], activeThreadId: null };
  }
}
