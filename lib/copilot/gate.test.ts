import { describe, it, expect } from 'vitest';
import {
  browserSessionStorage,
  checkCopilotPassword,
  consumedTokenOnLock,
  createUnlockStore,
  prefillToPass,
  readUnlocked,
  UNLOCK_KEY,
  writeUnlocked,
  type CopilotPrefill,
} from './gate';
import type { StorageLike } from './threads';

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

/** Storage that refuses every call (blocked site data, some private modes). */
class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
  removeItem(): void {
    throw new Error('SecurityError');
  }
}

const prefill = (token: number, scenario = 'Question'): CopilotPrefill => ({ scenario, autoSubmit: false, token });

describe('checkCopilotPassword', () => {
  it('accepts the password', () => {
    expect(checkCopilotPassword('nsl')).toBe(true);
  });

  it('ignores leading and trailing whitespace', () => {
    expect(checkCopilotPassword(' nsl ')).toBe(true);
    expect(checkCopilotPassword('\tnsl\n')).toBe(true);
  });

  it('is case-sensitive', () => {
    expect(checkCopilotPassword('NSL')).toBe(false);
    expect(checkCopilotPassword('Nsl')).toBe(false);
  });

  it('rejects empty, blank, partial and longer input', () => {
    expect(checkCopilotPassword('')).toBe(false);
    expect(checkCopilotPassword('   ')).toBe(false);
    expect(checkCopilotPassword('ns')).toBe(false);
    expect(checkCopilotPassword('nsl1')).toBe(false);
    expect(checkCopilotPassword('n s l')).toBe(false);
  });
});

describe('unlock flag storage', () => {
  it('uses the versioned session key', () => {
    expect(UNLOCK_KEY).toBe('switchrx.copilot.unlocked.v1');
  });

  it('starts locked', () => {
    expect(readUnlocked(new MemoryStorage())).toBe(false);
  });

  it('remembers an unlock and forgets it on lock', () => {
    const storage = new MemoryStorage();
    writeUnlocked(storage, true);
    expect(storage.map.has(UNLOCK_KEY)).toBe(true);
    expect(readUnlocked(storage)).toBe(true);

    writeUnlocked(storage, false);
    expect(storage.map.has(UNLOCK_KEY)).toBe(false);
    expect(readUnlocked(storage)).toBe(false);
  });

  it('treats anything but the value it writes as locked', () => {
    const storage = new MemoryStorage();
    storage.setItem(UNLOCK_KEY, 'true');
    expect(readUnlocked(storage)).toBe(false);
    storage.setItem(UNLOCK_KEY, '');
    expect(readUnlocked(storage)).toBe(false);
  });

  it('is locked and never throws without storage', () => {
    expect(readUnlocked(null)).toBe(false);
    expect(() => writeUnlocked(null, true)).not.toThrow();
    expect(() => writeUnlocked(null, false)).not.toThrow();
  });

  it('is locked and never throws when storage refuses every call', () => {
    const storage = new ThrowingStorage();
    expect(readUnlocked(storage)).toBe(false);
    expect(() => writeUnlocked(storage, true)).not.toThrow();
    expect(() => writeUnlocked(storage, false)).not.toThrow();
  });

  it('finds no session storage where the browser has none', () => {
    expect(browserSessionStorage()).toBeNull();
  });
});

describe('createUnlockStore', () => {
  it('starts locked and records unlock and lock in the storage', () => {
    const storage = new MemoryStorage();
    const store = createUnlockStore(() => storage);
    expect(store.getSnapshot()).toBe(false);

    store.unlock();
    expect(store.getSnapshot()).toBe(true);
    expect(storage.map.get(UNLOCK_KEY)).toBeDefined();

    store.lock();
    expect(store.getSnapshot()).toBe(false);
    expect(storage.map.has(UNLOCK_KEY)).toBe(false);
  });

  it('starts unlocked when the tab was unlocked before (a reload)', () => {
    const storage = new MemoryStorage();
    writeUnlocked(storage, true);
    expect(createUnlockStore(() => storage).getSnapshot()).toBe(true);
  });

  it('keeps the unlock for the life of the page when storage refuses, and lock still locks', () => {
    for (const storage of [new ThrowingStorage(), null]) {
      const store = createUnlockStore(() => storage);
      expect(store.getSnapshot()).toBe(false);
      store.unlock();
      expect(store.getSnapshot()).toBe(true);
      store.lock();
      expect(store.getSnapshot()).toBe(false);
    }
  });

  it('tells listeners about each change until they unsubscribe', () => {
    const store = createUnlockStore(() => new MemoryStorage());
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.unlock();
    store.lock();
    expect(calls).toBe(2);

    unsubscribe();
    store.unlock();
    expect(calls).toBe(2);
  });

  it('starts locked when the browser has no session storage', () => {
    expect(createUnlockStore().getSnapshot()).toBe(false);
  });
});

describe('prefillToPass', () => {
  it('passes nothing when there is no prefill', () => {
    expect(prefillToPass(null, null)).toBeNull();
    expect(prefillToPass(undefined, 5)).toBeNull();
  });

  it('passes a prefill the Copilot has not seen', () => {
    const p = prefill(1);
    expect(prefillToPass(p, null)).toBe(p);
    expect(prefillToPass(p, 0)).toBe(p);
  });

  it('does not pass a prefill that was already applied', () => {
    expect(prefillToPass(prefill(7), 7)).toBeNull();
  });

  it('passes a newer prefill after an earlier one was applied', () => {
    const next = prefill(8, 'Another');
    expect(prefillToPass(next, 7)).toBe(next);
  });
});

describe('consumedTokenOnLock', () => {
  it('marks the prefill the page holds as seen, since a mounted Copilot has been given it', () => {
    expect(consumedTokenOnLock(prefill(7), null)).toBe(7);
    expect(consumedTokenOnLock(prefill(9), 7)).toBe(9);
  });

  it('keeps the earlier mark when the page holds no prefill', () => {
    expect(consumedTokenOnLock(null, 7)).toBe(7);
    expect(consumedTokenOnLock(undefined, null)).toBeNull();
  });
});

// The gate as the page drives it: it keeps `consumed` across Lock and Unlock, while the Copilot mounts anew and
// applies any prefill whose token differs from the one it last applied.
describe('prefill across Lock and Unlock', () => {
  function simulate() {
    let consumed: number | null = null;
    /** The mounted Copilot's last applied token; undefined while it is not mounted. */
    let appliedByCopilot: number | null | undefined;
    const applied: number[] = [];
    const render = (pending: CopilotPrefill | null) => {
      if (appliedByCopilot === undefined) return; // locked: no Copilot to give it to
      const passed = prefillToPass(pending, consumed);
      if (passed && passed.token !== appliedByCopilot) {
        applied.push(passed.token);
        appliedByCopilot = passed.token;
      }
    };
    return {
      applied,
      render,
      unlock(pending: CopilotPrefill | null) {
        appliedByCopilot = null; // a fresh Copilot has seen no token
        render(pending);
      },
      lock(pending: CopilotPrefill | null) {
        appliedByCopilot = undefined;
        consumed = consumedTokenOnLock(pending, consumed);
      },
    };
  }

  it('applies a question sent while locked once, after unlock, and not again after Lock then Unlock', () => {
    const sim = simulate();
    const sentWhileLocked = prefill(100);

    sim.render(sentWhileLocked);
    expect(sim.applied).toEqual([]);

    sim.unlock(sentWhileLocked);
    expect(sim.applied).toEqual([100]);

    sim.render(sentWhileLocked); // an ordinary re-render
    sim.lock(sentWhileLocked);
    sim.unlock(sentWhileLocked);
    expect(sim.applied).toEqual([100]);
  });

  it('applies a question sent while the Copilot is open, but not again after Lock then Unlock', () => {
    const sim = simulate();
    sim.unlock(null);
    const sent = prefill(300);
    sim.render(sent);
    expect(sim.applied).toEqual([300]);

    sim.lock(sent);
    sim.unlock(sent);
    expect(sim.applied).toEqual([300]);
  });

  it('applies a question sent after Lock, once, on the next Unlock', () => {
    const sim = simulate();
    const first = prefill(100);
    sim.unlock(first);
    sim.lock(first);

    const second = prefill(200);
    sim.render(second);
    sim.unlock(second);
    expect(sim.applied).toEqual([100, 200]);

    sim.lock(second);
    sim.unlock(second);
    expect(sim.applied).toEqual([100, 200]);
  });

  it('applies the same question asked twice, because each request has its own token', () => {
    const sim = simulate();
    sim.unlock(null);
    sim.render(prefill(10, 'Same text'));
    sim.render(prefill(11, 'Same text'));
    expect(sim.applied).toEqual([10, 11]);
  });
});
