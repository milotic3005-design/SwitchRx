import { describe, expect, it } from 'vitest';
import { buildClinicalPrompt, emptyInput, updatePatientInput } from './IDSAAntibioticAdvisor';

const demographics = (prompt: string) =>
  prompt.split('\n').find(line => line.startsWith('**Demographics:**'));

describe('IDSA advisor: pregnancy is female-only', () => {
  it('does not send a male patient as pregnant, even if the flag was left on', () => {
    const prompt = buildClinicalPrompt({ ...emptyInput, age: '40', sex: 'M', pregnant: true });
    expect(prompt).not.toContain('PREGNANT');
    expect(demographics(prompt)).toBe('**Demographics:** 40 yo, Male');
  });

  it('does not send a patient with no sex chosen as pregnant', () => {
    const prompt = buildClinicalPrompt({ ...emptyInput, age: '40', sex: '', pregnant: true });
    expect(prompt).not.toContain('PREGNANT');
  });

  it('still sends a pregnant female patient as pregnant', () => {
    const prompt = buildClinicalPrompt({ ...emptyInput, age: '30', sex: 'F', pregnant: true });
    expect(demographics(prompt)).toBe('**Demographics:** 30 yo, Female, PREGNANT');
  });

  it('clears pregnant when sex changes from Female to Male', () => {
    const pregnantFemale = { ...emptyInput, sex: 'F' as const, pregnant: true };
    const next = updatePatientInput(pregnantFemale, 'sex', 'M');
    expect(next.sex).toBe('M');
    expect(next.pregnant).toBe(false);
  });

  it('keeps pregnant when a pregnant female patient has another field edited', () => {
    const pregnantFemale = { ...emptyInput, sex: 'F' as const, pregnant: true };
    expect(updatePatientInput(pregnantFemale, 'age', '31').pregnant).toBe(true);
    expect(updatePatientInput(pregnantFemale, 'sex', 'F').pregnant).toBe(true);
  });
});
