'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { runTurn, type CopilotTransport } from '@/lib/copilot/run-turn';
import { copilotReducer, type CopilotAction, type CopilotState } from '@/lib/copilot/state';
import { loadThreads, saveThreads, type StorageLike } from '@/lib/copilot/threads';
import { realTransport } from '@/lib/copilot/transport';
import { endsTurn, FINISHED_STATUSES, isRunning } from '@/lib/copilot/turn-status';
import type { CopilotThread, CopilotTurn, Depth, TurnPatch } from '@/lib/copilot/types';

interface Snapshot {
  state: CopilotState;
  storageAvailable: boolean;
}

const INITIAL: Snapshot = { state: { threads: [], activeThreadId: null }, storageAvailable: true };
const getInitialSnapshot = (): Snapshot => INITIAL;

/** `window.localStorage`, or null where reading it throws (blocked storage, some private modes). */
function browserStorage(): StorageLike | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** A unique id; `crypto.randomUUID` is missing outside secure contexts (e.g. the dev server over a LAN IP). */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The real backend, or the recorded demo in development with `?copilotDemo` in the URL. The demo
 * module is imported only inside the development branch, which production builds compile out, so the
 * fixture never reaches the production bundle.
 */
function loadTransport(): Promise<CopilotTransport> {
  if (process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).has('copilotDemo')) {
    return import('@/lib/copilot/demo').then(
      demo => (demo.isDemoEnabled(window.location.search) ? demo.demoTransport : realTransport),
      () => realTransport,
    );
  }
  return Promise.resolve(realTransport);
}

/**
 * The thread state plus its browser storage. State changes go through the pure reducer synchronously,
 * so a caller can see where an action left things straight away (`startTurn` may file the turn under a
 * new thread). Nothing is saved until the stored threads have been loaded, so the empty starting
 * state can never overwrite them.
 */
function createStore() {
  let snapshot = INITIAL;
  let storage: StorageLike | null = null;
  let hydrated = false;
  const listeners = new Set<() => void>();

  const publish = (next: Snapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    /** Loads the saved threads, once. */
    hydrate(from: StorageLike | null) {
      if (hydrated) return;
      hydrated = true;
      storage = from;
      publish({
        state: copilotReducer(snapshot.state, { type: 'load', threads: loadThreads(from) }),
        storageAvailable: from !== null,
      });
    },
    dispatch(action: CopilotAction) {
      const state = copilotReducer(snapshot.state, action);
      if (state === snapshot.state) return;
      // Only finished turns are saved, so a patch that leaves its turn unfinished changes nothing on disk;
      // skipping those keeps a streaming answer from rewriting the whole history on every chunk. An answer
      // being asked again for sources is already done, so it is saved, and a reload shows it finished.
      const leavesTurnUnfinished =
        action.type === 'patchTurn' &&
        (action.patch.status === undefined || !FINISHED_STATUSES.has(action.patch.status));
      const save = hydrated && !leavesTurnUnfinished;
      publish({
        state,
        storageAvailable: save ? saveThreads(storage, state.threads) === 'ok' : snapshot.storageAvailable,
      });
    },
  };
}

export interface Copilot {
  state: CopilotState;
  activeThread: CopilotThread | null;
  /** True while an answer is being generated, or asked again because it came back without sources. */
  busy: boolean;
  /** False when history cannot be saved in this browser (threads then live in memory only). */
  storageAvailable: boolean;
  ask(question: string, depth: Depth): void;
  stop(): void;
  retry(turnId: string): void;
  newQuestion(): void;
  openThread(id: string): void;
  deleteThread(id: string): void;
  clearAll(): void;
}

/**
 * The Copilot's threads and the one answer that may be running. Saved threads load on mount and every
 * change after that is saved. At most one answer runs at a time, with its own AbortController: asking
 * again, starting a new question, switching, deleting or clearing threads stops it first, and once it
 * is stopped nothing but the runner's final update is applied ("stopped", or "done" with the first answer
 * when it was being asked again for sources), always to the thread that holds the turn.
 */
export function useCopilot(): Copilot {
  const [store] = useState(createStore);
  const { state, storageAvailable } = useSyncExternalStore(store.subscribe, store.getSnapshot, getInitialSnapshot);
  const runRef = useRef<AbortController | null>(null);
  const transportRef = useRef<Promise<CopilotTransport> | null>(null);

  useEffect(() => {
    store.hydrate(browserStorage());
    transportRef.current ??= loadTransport();
    return () => {
      runRef.current?.abort();
      runRef.current = null;
    };
  }, [store]);

  const abortRunning = useCallback(() => {
    const controller = runRef.current;
    runRef.current = null;
    controller?.abort();
  }, []);

  /** Asks `question` in the open thread (or a new one); a retry leaves the turn it repeats out of the context. */
  const start = useCallback(
    (question: string, depth: Depth, retryOf?: string) => {
      const text = question.trim();
      if (!text) return;
      abortRunning();

      const askedAt = Date.now();
      const turn: CopilotTurn = {
        id: newId(),
        question: text,
        depth,
        askedAt,
        status: 'lookup',
        answer: '',
        followUps: [],
        supports: [],
        sources: [],
        lookup: null,
        lookupState: 'pending',
      };
      store.dispatch({
        type: 'startTurn',
        threadId: store.getSnapshot().state.activeThreadId,
        newThreadId: newId(),
        turn,
        now: askedAt,
      });

      // If the open thread no longer existed, the turn landed in a new thread: send every update there.
      const holder = store.getSnapshot().state.threads.find(t => t.turns.some(x => x.id === turn.id));
      if (!holder) return;
      const threadId = holder.id;
      const history = holder.turns.filter(t => t.id !== turn.id && t.id !== retryOf);

      const controller = new AbortController();
      runRef.current = controller;
      let ended = false;
      const onUpdate = (patch: TurnPatch) => {
        if (ended) return;
        if (controller.signal.aborted) {
          if (!endsTurn(patch)) return;
          ended = true;
        }
        store.dispatch({ type: 'patchTurn', threadId, turnId: turn.id, patch, now: Date.now() });
      };

      transportRef.current ??= loadTransport();
      void transportRef.current
        .then(transport => runTurn(transport, { history, question: text, depth }, onUpdate, controller.signal))
        .finally(() => {
          if (runRef.current === controller) runRef.current = null;
        });
    },
    [store, abortRunning],
  );

  const ask = useCallback((question: string, depth: Depth) => start(question, depth), [start]);

  const retry = useCallback(
    (turnId: string) => {
      const { threads, activeThreadId } = store.getSnapshot().state;
      const turn = threads.find(t => t.id === activeThreadId)?.turns.find(t => t.id === turnId);
      if (turn) start(turn.question, turn.depth, turn.id);
    },
    [store, start],
  );

  const newQuestion = useCallback(() => {
    abortRunning();
    store.dispatch({ type: 'newThread' });
  }, [store, abortRunning]);

  const openThread = useCallback(
    (id: string) => {
      // Re-opening the thread already on screen is not a switch, so its answer keeps running.
      if (store.getSnapshot().state.activeThreadId === id) return;
      abortRunning();
      store.dispatch({ type: 'openThread', threadId: id });
    },
    [store, abortRunning],
  );

  const deleteThread = useCallback(
    (id: string) => {
      abortRunning();
      store.dispatch({ type: 'deleteThread', threadId: id });
    },
    [store, abortRunning],
  );

  const clearAll = useCallback(() => {
    abortRunning();
    store.dispatch({ type: 'clearAll' });
  }, [store, abortRunning]);

  const activeThread = state.threads.find(t => t.id === state.activeThreadId) ?? null;
  const busy = state.threads.some(t => t.turns.some(turn => isRunning(turn)));

  return {
    state,
    activeThread,
    busy,
    storageAvailable,
    ask,
    stop: abortRunning,
    retry,
    newQuestion,
    openThread,
    deleteThread,
    clearAll,
  };
}
