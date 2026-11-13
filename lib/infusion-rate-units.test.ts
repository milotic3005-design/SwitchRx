import { describe, it, expect } from 'vitest';
import { canConvert, convertRate, convertRates, presetRates, toMgHr } from './infusion-rate-units';

describe('convertRate', () => {
  it('leaves the value alone when the unit does not change', () => {
    expect(convertRate(50, 'mg/hr', 'mg/hr', 1.4)).toBe(50);
    expect(convertRate(35.7, 'mL/hr', 'mL/hr', 1.4)).toBe(35.7);
  });

  it('converts mg/hr to mL/hr by the bag concentration', () => {
    expect(convertRate(50, 'mg/hr', 'mL/hr', 1)).toBe(50); // rituximab 700 mg in 700 mL
    expect(convertRate(36, 'mg/hr', 'mL/hr', 1.2)).toBe(30); // ocrelizumab 300 mg in 250 mL
    expect(convertRate(216, 'mg/hr', 'mL/hr', 1.2)).toBe(180);
  });

  it('converts mL/hr to mg/hr', () => {
    expect(convertRate(30, 'mL/hr', 'mg/hr', 1.2)).toBe(36);
    expect(convertRate(180, 'mL/hr', 'mg/hr', 1.2)).toBe(216);
  });

  it('rounds an inexact conversion to 0.1, the precision pumps use', () => {
    expect(convertRate(50, 'mg/hr', 'mL/hr', 1.4)).toBe(35.7);
    expect(convertRate(400, 'mg/hr', 'mL/hr', 0.7)).toBe(571.4);
  });
});

describe('convertRates', () => {
  it('converts all three rates and keeps an empty field empty', () => {
    expect(convertRates({ start: 36, step: '', max: 216 }, 'mg/hr', 'mL/hr', 1.2)).toEqual({ start: 30, step: '', max: 180 });
  });
});

describe('toMgHr', () => {
  it('gives the exact mg/hr the schedule runs on, without rounding', () => {
    expect(toMgHr(50, 'mg/hr', 1.4)).toBe(50);
    expect(toMgHr(30, 'mL/hr', 1.2)).toBeCloseTo(36, 10);
    expect(toMgHr(35.7, 'mL/hr', 1.4)).toBeCloseTo(49.98, 10);
  });
});

describe('canConvert', () => {
  it('needs a positive, finite concentration', () => {
    expect(canConvert(1.2)).toBe(true);
    for (const bad of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(canConvert(bad), String(bad)).toBe(false);
  });
});

describe('presetRates', () => {
  const ocrelizumab = { startRate: 36, stepIncrement: 36, maxRate: 216, defaultDose: 300, defaultVolume: 250 };

  it('fills a preset as stored in mg/hr mode', () => {
    expect(presetRates(ocrelizumab, 'mg/hr', null)).toEqual({ unit: 'mg/hr', start: 36, step: 36, max: 216 });
  });

  it("converts a preset with its own bag in mL/hr mode", () => {
    // The current bag (1 mg/mL) is ignored: the preset sets its own dose and volume.
    expect(presetRates(ocrelizumab, 'mL/hr', 1)).toEqual({ unit: 'mL/hr', start: 30, step: 30, max: 180 });
  });

  it('uses the current bag when the preset has none, and falls back to mg/hr without one', () => {
    const noBag = { startRate: 50, stepIncrement: 0, maxRate: 50 };
    expect(presetRates(noBag, 'mL/hr', 2)).toEqual({ unit: 'mL/hr', start: 25, step: 0, max: 25 });
    expect(presetRates(noBag, 'mL/hr', null)).toEqual({ unit: 'mg/hr', start: 50, step: 0, max: 50 });
  });
});
