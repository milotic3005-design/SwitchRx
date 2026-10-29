import { describe, it, expect } from 'vitest';
import { EXAMPLE_CATEGORIES, SHORTCUTS } from './examples';

describe('Copilot example library', () => {
  it('pins the shortcut labels and the ten example categories', () => {
    expect(SHORTCUTS.map(s => s.label)).toEqual(['Dose & renal adjustment', 'Preparation & stability', 'Infusion reactions']);
    expect(EXAMPLE_CATEGORIES).toHaveLength(10);
    for (const c of EXAMPLE_CATEGORIES) expect(c.examples.length).toBeGreaterThanOrEqual(2), expect(c.examples.length).toBeLessThanOrEqual(3);
  });

  it('keeps the categories in the documented order', () => {
    expect(EXAMPLE_CATEGORIES.map(c => c.title)).toEqual([
      'Dosing & renal adjustment',
      'Preparation, stability & BUD',
      'Administration & rates',
      'Premeds & infusion reactions',
      'Monitoring & TDM',
      'Compatibility & line access',
      'OPAT & home infusion',
      'Biologics & biosimilars',
      'Oncology supportive care',
      'Shortages & alternatives',
    ]);
  });

  it('gives every shortcut and example a usable, distinct question', () => {
    const questions = [...SHORTCUTS.map(s => s.text), ...EXAMPLE_CATEGORIES.flatMap(c => c.examples)];
    for (const q of questions) {
      expect(q).toBe(q.trim());
      expect(q.length).toBeGreaterThan(20);
      expect(q.endsWith('?')).toBe(true);
    }
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('is written as questions only: no brand terms or patient identifiers', () => {
    const everything = [...SHORTCUTS.map(s => s.text), ...EXAMPLE_CATEGORIES.flatMap(c => [c.title, ...c.examples])].join('\n');
    expect(everything).not.toMatch(/openevidence|evidencegrade|osler|sackett|\bsnow\b|hipaa/i);
    // No MRN / DOB / phone / email shaped text.
    expect(everything).not.toMatch(/\bMRN\b|\bDOB\b|\d{3}[-.\s]\d{3,4}[-.\s]\d{4}|@\w+\.\w+/i);
  });
});
