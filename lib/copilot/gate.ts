import type { StorageLike } from './threads';

// A convenience screen, not security: the password ships in the client bundle, which was accepted.
const COPILOT_PASSWORD = 'nsl';

/** Session storage, so an unlock lasts until the browser tab closes. */
export const UNLOCK_KEY = 'switchrx.copilot.unlocked.v1';

const UNLOCKED_VALUE = '1';

/** A question handed over from another tab; `token` is new for every request. */
export interface CopilotPrefill {
  scenario: string;
  autoSubmit: boolean;
  token: number;
}

/** True only for the password itself, ignoring surrounding whitespace; case matters. */
export function checkCopilotPassword(input: string): boolean {
  return input.trim() === COPILOT_PASSWORD;
}

/** `window.sessionStorage`, or null where there is none or reading it throws (blocked storage, some private modes). */
export function browserSessionStorage(): StorageLike | null {
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Whether this tab was unlocked. Never throws: no storage, or storage that refuses, reads as locked. */
export function readUnlocked(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(UNLOCK_KEY) === UNLOCKED_VALUE;
  } catch {
    return false;
  }
}

/** Records or clears the unlock. Never throws: without working storage the caller's own state is all there is. */
export function writeUnlocked(storage: StorageLike | null, unlocked: boolean): void {
  if (!storage) return;
  try {
    if (unlocked) storage.setItem(UNLOCK_KEY, UNLOCKED_VALUE);
    else storage.removeItem(UNLOCK_KEY);
  } catch {
    // Nothing more to do: the unlock then lasts for the life of the page.
  }
}

/** The unlock as one external value for React: the stored flag, or the page's own memory where storage fails. */
export function createUnlockStore(getStorage: () => StorageLike | null = browserSessionStorage) {
  // Without working storage this is all there is, so the unlock lasts for the life of the page.
  let inMemory = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: (): boolean => inMemory || readUnlocked(getStorage()),
    unlock() {
      inMemory = true;
      writeUnlocked(getStorage(), true);
      notify();
    },
    lock() {
      inMemory = false;
      writeUnlocked(getStorage(), false);
      notify();
    },
  };
}

/**
 * The prefill to hand the Copilot: none whose token was already applied. A Copilot that mounts again
 * after Lock then Unlock has seen no token, so it would apply the same question a second time;
 * `consumedToken` is the last one it had by the time it was locked, kept by the gate, which outlives it.
 */
export function prefillToPass(
  prefill: CopilotPrefill | null | undefined,
  consumedToken: number | null,
): CopilotPrefill | null {
  return prefill && prefill.token !== consumedToken ? prefill : null;
}

/**
 * The token to remember when the Copilot is locked. A mounted Copilot is given every prefill the page
 * holds, so by then it has applied the current one, and a later mount must not apply it again.
 */
export function consumedTokenOnLock(
  prefill: CopilotPrefill | null | undefined,
  consumedToken: number | null,
): number | null {
  return prefill ? prefill.token : consumedToken;
}
