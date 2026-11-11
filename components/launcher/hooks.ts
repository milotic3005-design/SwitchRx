"use client";
import { useMemo, useSyncExternalStore } from 'react';
import { DRUG_DB } from '@/data/drug-database';
import { isCalcId } from '@/lib/launcher/catalog';
import { parseRecents, readRecentsRaw, subscribeRecents } from '@/lib/launcher/recents';
import type { RecentItem } from '@/lib/launcher/search';

const KNOWN = { hasDrug: (id: string) => DRUG_DB.some(d => d.id === id), hasCalc: (id: string) => isCalcId(id) };

/**
 * The recent drugs and calculators stored in this browser, live. The stored text is the external value (a
 * string compares by value), so the server and the first client render both see none.
 */
export function useRecents(): RecentItem[] {
  const raw = useSyncExternalStore(subscribeRecents, () => readRecentsRaw(), () => null);
  return useMemo(() => parseRecents(raw, KNOWN), [raw]);
}

const never = () => () => {};
const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** How the search shortcut is written on this computer: "⌘K" on Apple devices (and on the server), "Ctrl K" elsewhere. */
export function useShortcutHint(): string {
  return useSyncExternalStore(never, () => (isApple() ? '⌘K' : 'Ctrl K'), () => '⌘K');
}

/** True once mounted on a device with a mouse or trackpad; false on the server and on touch devices. */
export function useFinePointer(): boolean {
  return useSyncExternalStore(never, () => window.matchMedia('(pointer: fine)').matches, () => false);
}
