import { DRUG_ACTIONS, rowTarget, type ResultRow, type Target } from './search';

/** Where the search panel's highlight is: the row in the flat list, and the action within a drug row. */
export interface PanelState {
  active: number;
  action: number;
}

export const INITIAL_PANEL: PanelState = { active: 0, action: 0 };

export type PanelKey = 'ArrowDown' | 'ArrowUp' | 'Tab' | 'ShiftTab';

/** A drug row offers its three actions unless it carries its own place (a recent item). */
const hasActions = (row: ResultRow | undefined): boolean => row?.kind === 'drug' && row.dest === undefined;

/**
 * The state after a key. Arrows move between rows and stop at both ends; a new row starts at its first
 * action. Tab and Shift+Tab cycle a drug row's actions. `handled` is false when the key did nothing here,
 * so the caller can let the browser have it.
 */
export function panelKey(state: PanelState, key: PanelKey, rows: ResultRow[]): { state: PanelState; handled: boolean } {
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (rows.length === 0) return { state, handled: false };
    const active = Math.min(Math.max(state.active + (key === 'ArrowDown' ? 1 : -1), 0), rows.length - 1);
    return { state: active === state.active ? state : { active, action: 0 }, handled: true };
  }
  if (!hasActions(rows[state.active])) return { state, handled: false };
  const n = DRUG_ACTIONS.length;
  return { state: { active: state.active, action: (state.action + (key === 'Tab' ? 1 : n - 1)) % n }, handled: true };
}

/** Where Enter leads from `state`, or null when there are no rows. */
export function activeTarget(state: PanelState, rows: ResultRow[]): Target | null {
  const row = rows[state.active];
  return row ? rowTarget(row, state.action) : null;
}

/** Cmd+K or Ctrl+K (one of the two, without Alt): the shortcut that opens the search. */
export function isPaletteShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean }): boolean {
  return e.key.toLowerCase() === 'k' && e.metaKey !== e.ctrlKey && !e.altKey;
}
