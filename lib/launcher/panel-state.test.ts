import { describe, it, expect } from 'vitest';
import { INITIAL_PANEL, activeTarget, isPaletteShortcut, panelKey } from './panel-state';
import { searchAll } from './search';

// [drug Vancomycin, …more drugs, calculator Vancomycin AUC Dosing]
const rows = searchAll('vanc', []).flatMap(s => s.rows);

describe('panelKey', () => {
  it('moves with the arrows and clamps', () => {
    expect(panelKey(INITIAL_PANEL, 'ArrowUp', rows).state.active).toBe(0);
    let s = INITIAL_PANEL;
    for (let i = 0; i < rows.length + 3; i++) s = panelKey(s, 'ArrowDown', rows).state;
    expect(s.active).toBe(rows.length - 1);
  });

  it("cycles a drug row's three actions with Tab and resets on a row change", () => {
    let r = panelKey(INITIAL_PANEL, 'Tab', rows);
    expect(r).toEqual({ state: { active: 0, action: 1 }, handled: true });
    r = panelKey(panelKey(r.state, 'Tab', rows).state, 'Tab', rows);
    expect(r.state.action).toBe(0);
    expect(panelKey({ active: 0, action: 0 }, 'ShiftTab', rows).state.action).toBe(2);
    expect(panelKey({ active: 0, action: 2 }, 'ArrowDown', rows).state.action).toBe(0);
  });

  it('leaves Tab alone on a row with one action', () => {
    const last = { active: rows.length - 1, action: 0 };
    expect(panelKey(last, 'Tab', rows)).toEqual({ state: last, handled: false });
    expect(panelKey(INITIAL_PANEL, 'Tab', [])).toEqual({ state: INITIAL_PANEL, handled: false });
  });
});

describe('activeTarget', () => {
  it('gives the active target', () => {
    expect(activeTarget({ active: 0, action: 1 }, rows)).toMatchObject({ kind: 'drug', dest: 'reference' });
    expect(activeTarget(INITIAL_PANEL, [])).toBeNull();
  });
});

describe('isPaletteShortcut', () => {
  it('recognises the shortcut', () => {
    const e = { key: 'k', metaKey: false, ctrlKey: false, altKey: false };
    expect(isPaletteShortcut({ ...e, metaKey: true })).toBe(true);
    expect(isPaletteShortcut({ ...e, key: 'K', ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut(e)).toBe(false);
    expect(isPaletteShortcut({ ...e, metaKey: true, ctrlKey: true })).toBe(false);
    expect(isPaletteShortcut({ ...e, ctrlKey: true, altKey: true })).toBe(false);
    expect(isPaletteShortcut({ ...e, key: 'j', metaKey: true })).toBe(false);
  });
});
