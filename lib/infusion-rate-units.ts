// Rate units for the Biologic Rate Titration calculator. Titration parameters can be entered in mg/hr (how most
// biologic labels state them) or mL/hr (how some, such as Ocrevus, do, and what the pump is set to). The schedule
// always runs on mg/hr; the bag's concentration (mg/mL) converts between the two.

export type RateUnit = 'mg/hr' | 'mL/hr';

/** A rate field's value: a number, or '' while the field is empty. */
export type RateValue = number | '';

export interface Rates {
  start: RateValue;
  step: RateValue;
  max: RateValue;
}

/** Whether `concMgPerMl` can convert between the units: a positive, finite number. */
export function canConvert(concMgPerMl: number | null): concMgPerMl is number {
  return typeof concMgPerMl === 'number' && Number.isFinite(concMgPerMl) && concMgPerMl > 0;
}

/** Rounded to 0.1, the precision pumps are programmed in. */
const tenth = (n: number) => Math.round(n * 10) / 10;

/** `value` in unit `to`, rounded to 0.1 when the unit changes. Unchanged when `from` and `to` are the same. */
export function convertRate(value: number, from: RateUnit, to: RateUnit, concMgPerMl: number): number {
  if (from === to) return value;
  return tenth(from === 'mg/hr' ? value / concMgPerMl : value * concMgPerMl);
}

/** All three titration rates converted from one unit to the other; an empty field stays empty. */
export function convertRates(rates: Rates, from: RateUnit, to: RateUnit, concMgPerMl: number): Rates {
  const one = (v: RateValue): RateValue => (v === '' ? '' : convertRate(v, from, to, concMgPerMl));
  return { start: one(rates.start), step: one(rates.step), max: one(rates.max) };
}

/** The exact mg/hr the schedule runs on, for a rate entered in `unit`. No rounding: the entered value is the regimen. */
export function toMgHr(value: number, unit: RateUnit, concMgPerMl: number): number {
  return unit === 'mg/hr' ? value : value * concMgPerMl;
}

/**
 * A preset's rates for the chosen unit. Presets are stored in mg/hr; in mL/hr mode they are converted with the
 * preset's own bag (default dose ÷ default volume), or with the current bag when the preset has none. With no bag
 * at all they are filled in mg/hr, and the unit returned says so.
 */
export function presetRates(
  preset: { startRate: number; stepIncrement: number; maxRate: number; defaultDose?: number; defaultVolume?: number },
  unit: RateUnit,
  currentConcMgPerMl: number | null,
): { unit: RateUnit; start: number; step: number; max: number } {
  const own = preset.defaultDose && preset.defaultVolume ? preset.defaultDose / preset.defaultVolume : null;
  const conc = canConvert(own) ? own : currentConcMgPerMl;
  const target: RateUnit = unit === 'mL/hr' && canConvert(conc) ? 'mL/hr' : 'mg/hr';
  const convert = (v: number) => (target === 'mg/hr' ? v : convertRate(v, 'mg/hr', 'mL/hr', conc as number));
  return { unit: target, start: convert(preset.startRate), step: convert(preset.stepIncrement), max: convert(preset.maxRate) };
}
