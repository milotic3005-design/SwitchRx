import { DRUG_ACTIONS, type RecentItem } from './search';

/** The part of `Storage` the recent list needs, so tests can pass their own. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const RECENTS_KEY = 'switchrx.recents.v1';
export const RECENTS_MAX = 5;

/** Fired on `window` after this tab changes the list; other tabs hear the browser's own `storage` event. */
const RECENTS_EVENT = 'switchrx:recents';

/** `list` with `item` at the front: one entry per drug or calculator, capped at `RECENTS_MAX`. */
export function addRecent(list: RecentItem[], item: RecentItem): RecentItem[] {
  return [item, ...list.filter(x => !(x.kind === item.kind && x.id === item.id))].slice(0, RECENTS_MAX);
}

const isDest = (x: unknown): x is NonNullable<RecentItem['dest']> => DRUG_ACTIONS.some(a => a.dest === x);

/** One stored entry as a recent item, or null when it is not one. Only the known fields are kept. */
function toRecent(x: unknown): RecentItem | null {
  if (typeof x !== 'object' || x === null) return null;
  const { kind, id, dest } = x as Record<string, unknown>;
  if (typeof id !== 'string') return null;
  if (kind === 'calculator') return { kind, id };
  if (kind === 'drug' && isDest(dest)) return { kind, id, dest };
  return null;
}

/**
 * The stored list, tolerant of anything: bad JSON, the wrong shape, or an id `known` no longer has all
 * give a shorter (or empty) list rather than an error.
 */
export function parseRecents(
  raw: string | null,
  known: { hasDrug(id: string): boolean; hasCalc(id: string): boolean },
): RecentItem[] {
  if (!raw) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  return stored
    .flatMap(x => toRecent(x) ?? [])
    .filter(item => (item.kind === 'drug' ? known.hasDrug(item.id) : known.hasCalc(item.id)))
    .slice(0, RECENTS_MAX);
}

/** This browser's storage, or null on the server or where storage is blocked. */
function browserStore(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The stored list as text, or null when there is none or storage cannot be read. */
export function readRecentsRaw(storage: KeyValueStore | null = browserStore()): string | null {
  try {
    return storage?.getItem(RECENTS_KEY) ?? null;
  } catch {
    return null;
  }
}

const ANY = { hasDrug: () => true, hasCalc: () => true };

/** Puts `item` at the front of the stored list. Where storage is blocked or full, nothing is kept. */
export function recordRecent(item: RecentItem, storage: KeyValueStore | null = browserStore()): void {
  if (!storage) return;
  try {
    storage.setItem(RECENTS_KEY, JSON.stringify(addRecent(parseRecents(readRecentsRaw(storage), ANY), item)));
  } catch {
    return;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RECENTS_EVENT));
}

/** Calls `onChange` whenever the stored list changes, in this tab or another. Returns the unsubscribe. */
export function subscribeRecents(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === RECENTS_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(RECENTS_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(RECENTS_EVENT, onChange);
  };
}
