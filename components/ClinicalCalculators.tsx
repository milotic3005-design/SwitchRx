'use client';

import { useState } from 'react';
import { Calculator, SlidersHorizontal, ListChecks, ChevronDown, Activity, AlertTriangle, ArrowUp, ArrowDown, Pause, Check, Droplets } from 'lucide-react';
import { IVIGRateCalculator } from './IVIGRateCalculator';
import { InfusionRateCalculator } from './InfusionRateCalculator';
import { IDSAAntibioticAdvisor } from './IDSAAntibioticAdvisor';

// ── CADD drug presets ──────────────────────────────────────────────────────────
// Concentration, KVO, concentration range, unit, and stability notes are sourced
// directly from the "CADD bag calculator" workbook. Dose and frequency are NOT in
// that workbook (they are patient-specific), so they default to a typical OPAT
// starting point the user adjusts.
type CADDPreset = {
  dose: number; freq: number;          // typical starting point — user-editable
  conc: number; kvo: number;           // pulled from the CADD bag calculator workbook
  concLabel: string; unit: string;     // workbook concentration range + units
  note?: string;                       // workbook stability / handling note
};
const CADD_PRESETS: Record<string, CADDPreset> = {
  'Acyclovir':                       { dose: 750,     freq: 8,  conc: 7,     kvo: 0.8, concLabel: '1–7',      unit: 'mg/mL',    note: 'Extended stability 4 days RT; sterility 48 h RT.' },
  'Aztreonam':                       { dose: 2000,    freq: 8,  conc: 10,    kvo: 0.8, concLabel: '10',       unit: 'mg/mL',    note: 'Less stable at 20 mg/mL.' },
  'Cefazolin':                       { dose: 2000,    freq: 8,  conc: 20,    kvo: 2,   concLabel: '20',       unit: 'mg/mL' },
  'Cefepime':                        { dose: 2000,    freq: 8,  conc: 10,    kvo: 0.8, concLabel: '10',       unit: 'mg/mL' },
  'Ceftazidime':                     { dose: 2000,    freq: 8,  conc: 20,    kvo: 2,   concLabel: '10 or 20', unit: 'mg/mL' },
  'Ceftriaxone':                     { dose: 2000,    freq: 24, conc: 10,    kvo: 2,   concLabel: '10',       unit: 'mg/mL' },
  'Ganciclovir':                     { dose: 350,     freq: 12, conc: 5,     kvo: 0.8, concLabel: '1–5',      unit: 'mg/mL' },
  'Meropenem':                       { dose: 1000,    freq: 8,  conc: 10,    kvo: 0.8, concLabel: '5–10',     unit: 'mg/mL',    note: 'Unstable at higher concentration (~4 d fridge / 25 h RT). Consider ertapenem if ESBL.' },
  'Nafcillin':                       { dose: 2000,    freq: 4,  conc: 20,    kvo: 2,   concLabel: '20–25',    unit: 'mg/mL',    note: 'Very thick solution.' },
  'Penicillin G':                    { dose: 4000000, freq: 4,  conc: 20000, kvo: 2,   concLabel: '20,000',   unit: 'units/mL', note: 'Dose & concentration are in UNITS. Final units = final volume × concentration.' },
  'Piperacillin/Tazobactam (Zosyn)': { dose: 4500,    freq: 8,  conc: 33.75, kvo: 2,   concLabel: '33.75',    unit: 'mg/mL' },
  'Ampicillin/Sulbactam (Unasyn)':   { dose: 3000,    freq: 6,  conc: 30,    kvo: 0.8, concLabel: '30',       unit: 'mg/mL' },
  'Vancomycin':                      { dose: 1250,    freq: 12, conc: 10,    kvo: 0.8, concLabel: '10',       unit: 'mg/mL' },
};

const DAYS = [1, 2, 3, 4, 5];

// ── Calculator list ────────────────────────────────────────────────────────────
const CALCULATORS = [
  { id: 'idsa-abx', label: 'IDSA Antibiotic Advisor' },
  { id: 'cadd',    label: 'CADD Bag Calculator' },
  { id: 'ivig',   label: 'IVIG Infusion Rate' },
  { id: 'biolrate', label: 'Biologic Rate Titration' },
  { id: 'vanco',  label: 'Vancomycin AUC Dosing' },
  { id: 'crcl',   label: 'CrCl (Cockcroft-Gault)' },
  // Combined: BMI + Ideal/Adjusted Body Weight all from one set of inputs.
  { id: 'bodywt', label: 'Body Weight & BMI' },
  { id: 'iron',   label: 'Iron Deficit (Ganzoni)' },
  { id: 'esa',    label: 'ESA Dosing (CKD Anemia)' },
  { id: 'calcium',label: 'Corrected Calcium' },
];

// ── Shared style helpers ───────────────────────────────────────────────────────
const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors';

const labelCls = 'block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5';

function ResultBadge({
  label, value, unit, color = 'blue',
}: { label: string; value: string | null; unit: string; color?: string }) {
  const colorMap: Record<string, string> = {
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    rose:    'bg-rose-500/10 border-rose-500/20 text-rose-400',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    violet:  'bg-violet-500/10 border-violet-500/20 text-violet-400',
  };
  return (
    <div className={`mt-6 p-4 rounded-xl border flex justify-between items-center ${colorMap[color]}`}>
      <span className="text-sm font-semibold opacity-80">{label}</span>
      {value !== null ? (
        <span className="text-xl font-bold">
          {value} <span className="text-sm font-normal opacity-70">{unit}</span>
        </span>
      ) : (
        <span className="text-sm font-normal opacity-50 italic">Enter values above</span>
      )}
    </div>
  );
}

function UnitToggle({ unit, onClick }: { unit: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white/10 hover:bg-white/15 text-slate-300 text-[10px] font-bold rounded-lg transition-colors uppercase"
    >
      {unit}
    </button>
  );
}

// ── Vancomycin AUC-guided Dosing ────────────────────────────────────────────────
// Implements the 2020 ASHP/IDSA/PIDS/SIDP consensus methodology: AUC24/MIC
// target of 400–600 mg·h/L (assuming MIC = 1 mg/L by broth microdilution).
// Two workflows:
//   • Empiric — population PK (Cockcroft-Gault CrCl → Matzke kel → CL/Vd) used
//     to recommend a maintenance dose/interval and project AUC24, Cmax, Cmin.
//   • Bayesian-style two-level — first-order kinetics from a measured peak +
//     trough to compute the patient-specific AUC24, then recommend a dose
//     adjustment to land mid-target.
//
// NOTE: This is a decision-support estimate, not a substitute for a validated
// Bayesian platform or a clinical pharmacist's judgment. Population estimates
// assume reasonably stable renal function.

const VANCO_AUC_LOW = 400;
const VANCO_AUC_HIGH = 600;
const VANCO_AUC_MID = 500;

// Devine IBW (kg). Below 5 ft, floor at base value.
function vancoIBW(heightIn: number, female: boolean): number {
  const base = female ? 45.5 : 50;
  return base + Math.max(0, 2.3 * (heightIn - 60));
}

// Dosing weight: actual body weight, but use AdjBW when ABW > 1.2 × IBW
// (obesity), a common vancomycin convention. Returns kg.
function vancoDosingWeight(actualKg: number, ibwKg: number): { weight: number; basis: string } {
  if (ibwKg > 0 && actualKg > 1.2 * ibwKg) {
    const adj = ibwKg + 0.4 * (actualKg - ibwKg);
    return { weight: adj, basis: 'Adjusted BW (obese)' };
  }
  return { weight: actualKg, basis: 'Actual BW' };
}

// ── Goti et al. (2018) two-compartment vancomycin popPK model ───────────────────
// Selected after reviewing the literature: Broeker et al. (Clin Microbiol Infect
// 2019) encoded 31 published vancomycin models in NONMEM and tested Bayesian
// forecasting against 292 patients — the Goti model had the best predictive
// performance (rBias −4.41%, rRMSE 44.3%) and is the recommended model for
// precision dosing. It is the default adult model in several commercial Bayesian
// platforms (e.g. InsightRX).
//
// Structure (DIAL = 1 if on hemodialysis, else 0):
//   CL  = 4.5 × (CrCl/120)^0.8 × 0.7^DIAL   (L/h)   — CrCl capped at 150 mL/min
//   Vc  = 58.4 × (TBW/70) × 0.5^DIAL        (L)
//   Q   = 6.5 L/h     Vp = 38.4 L
//   BSV (lognormal, %CV): ωCL 39.8 · ωVc 81.6 · ωVp 57.1
//
// Residual error: the structural model, covariates and ω are the published Goti
// values. For the residual model we use a combined proportional + additive error
// of σ_prop 0.20 (20% CV) + σ_add 1.0 mg/L — the well-established vancomycin
// assay/model residual. (This drives only the weighting of measured levels vs
// the prior in the MAP fit; validated below to recover known CL/AUC tightly with
// two levels while leaving appropriate prior influence for a single level.)
const GOTI = {
  CL_TV: 4.5, CL_CRCL_EXP: 0.8, CL_DIAL: 0.7,
  VC_TV: 58.4, VC_WT_REF: 70, VC_DIAL: 0.5,
  Q: 6.5, VP: 38.4,
  OMEGA_CL: 0.398, OMEGA_VC: 0.816, OMEGA_VP: 0.571,
  SIGMA_PROP: 0.20, SIGMA_ADD: 1.0,
  CRCL_CAP: 150,
} as const;

type VancoLevel = { conc: number; time: number }; // time = h AFTER end of infusion

// Goti population typical-value parameters for a given patient.
function gotiTypical(crcl: number, tbw: number, dial: boolean): {
  cl: number; vc: number; q: number; vp: number;
} {
  const crclCapped = Math.min(crcl, GOTI.CRCL_CAP);
  const d = dial ? 1 : 0;
  const cl = GOTI.CL_TV * Math.pow(crclCapped / 120, GOTI.CL_CRCL_EXP) * Math.pow(GOTI.CL_DIAL, d);
  const vc = GOTI.VC_TV * (tbw / GOTI.VC_WT_REF) * Math.pow(GOTI.VC_DIAL, d);
  return { cl, vc, q: GOTI.Q, vp: GOTI.VP };
}

// Two-compartment steady-state concentration for an intermittent infusion.
// Uses the analytic biexponential solution. Returns concentration at
// `tAfterInfEnd` hours after the END of a tInf-hour infusion at steady state.
function vanco2cSSConc(
  cl: number, vc: number, q: number, vp: number,
  dose: number, tau: number, tInf: number, tAfterInfEnd: number,
): number {
  const k10 = cl / vc;
  const k12 = q / vc;
  const k21 = q / vp;
  const sum = k10 + k12 + k21;
  const disc = Math.sqrt(Math.max(sum * sum - 4 * k10 * k21, 0));
  const alpha = (sum + disc) / 2; // fast
  const beta = (sum - disc) / 2;  // slow
  const r0 = dose / tInf;

  // Coefficients for the infusion model (per Vc), standard 2-comp form.
  const aCoef = (alpha - k21) / (vc * (alpha - beta));
  const bCoef = (beta - k21) / (vc * (beta - alpha));

  // Steady-state concentration as a function of time since end of infusion,
  // for each exponential phase λ with coefficient C:
  //   Cλ_ss = R0·C/λ · (1−e^−λ·tInf)/(1−e^−λ·τ) · e^−λ·tAfter
  const phase = (lambda: number, coef: number): number => {
    const accumulation = (1 - Math.exp(-lambda * tInf)) / (1 - Math.exp(-lambda * tau));
    return (r0 * coef / lambda) * accumulation * Math.exp(-lambda * tAfterInfEnd);
  };
  return phase(alpha, aCoef) + phase(beta, bCoef);
}

// AUC over one dosing interval at steady state for the 2-comp model. At steady
// state, AUC_τ = Dose / CL (mass balance), independent of compartment structure.
function vanco2cAUCtau(cl: number, dose: number): number {
  return dose / cl;
}

// Maximum a posteriori (MAP) Bayesian estimate of individual CL and Vc using the
// Goti model as the population prior plus 1+ measured levels. Minimises:
//   OFV = Σ[(Cobs−Cpred)/σ]²  +  (ηCL/ωCL)² + (ηVc/ωVc)²
// with a combined additive+proportional residual error model and lognormal BSV.
// η are deviations from the Goti typical CL/Vc; Q and Vp are held at population
// values (their BSV contributes little to AUC). A single level is sufficient —
// the prior supplies what one observation can't, which is why single-trough AUC
// monitoring works. Solved by deterministic coarse-to-fine grid search.
function vancoMAPGoti(opts: {
  clPop: number; vcPop: number; q: number; vp: number;
  dose: number; tau: number; tInf: number; levels: VancoLevel[];
}): { cl: number; vc: number } | null {
  const { clPop, vcPop, q, vp, dose, tau, tInf, levels } = opts;
  if (!(clPop > 0 && vcPop > 0 && dose > 0 && tau > 0 && tInf > 0) || levels.length === 0) return null;

  const ofv = (etaCL: number, etaVc: number): number => {
    const cl = clPop * Math.exp(etaCL);
    const vc = vcPop * Math.exp(etaVc);
    let resid = 0;
    for (const lv of levels) {
      const cpred = vanco2cSSConc(cl, vc, q, vp, dose, tau, tInf, lv.time);
      if (cpred < 1e-6) return Number.POSITIVE_INFINITY;
      // Combined error: SD = sqrt(σ_add² + (σ_prop·Cpred)²)
      const sd = Math.sqrt(GOTI.SIGMA_ADD ** 2 + (GOTI.SIGMA_PROP * cpred) ** 2);
      const w = (lv.conc - cpred) / sd;
      resid += w * w;
    }
    return resid + (etaCL / GOTI.OMEGA_CL) ** 2 + (etaVc / GOTI.OMEGA_VC) ** 2;
  };

  let best = { a: 0, b: 0, f: ofv(0, 0) };
  // Coarse pass: ±2.0 (~±5 SD on the wide Vc ω) on each η.
  for (let a = -2.0; a <= 2.0001; a += 0.08) {
    for (let b = -2.0; b <= 2.0001; b += 0.08) {
      const f = ofv(a, b);
      if (f < best.f) best = { a, b, f };
    }
  }
  // Fine pass around the coarse optimum.
  const a0 = best.a, b0 = best.b;
  for (let a = a0 - 0.08; a <= a0 + 0.0801; a += 0.005) {
    for (let b = b0 - 0.08; b <= b0 + 0.0801; b += 0.005) {
      const f = ofv(a, b);
      if (f < best.f) best = { a, b, f };
    }
  }
  return { cl: clPop * Math.exp(best.a), vc: vcPop * Math.exp(best.b) };
}

function VancomycinAUCCalculator() {
  const [mode, setMode] = useState<'empiric' | 'levels' | 'bayesian'>('empiric');

  // ── Shared demographics ──
  const [age, setAge] = useState('');
  const [scr, setScr] = useState('');
  const [female, setFemale] = useState(false);
  const [ht, setHt] = useState('');
  const [htUnit, setHtUnit] = useState('cm');
  const [wt, setWt] = useState('');
  const [wtUnit, setWtUnit] = useState('kg');

  const htIn = htUnit === 'cm' ? parseFloat(ht) / 2.54 : parseFloat(ht);
  const actualKg = wtUnit === 'lb' ? parseFloat(wt) / 2.20462 : parseFloat(wt);
  const ageN = parseFloat(age);
  const scrN = parseFloat(scr);

  // ── Empiric PK engine ──
  const empiric = (() => {
    if (!(ageN > 0 && actualKg > 0 && scrN > 0 && htIn > 0)) return null;

    const ibw = vancoIBW(htIn, female);
    // Cockcroft-Gault using the lower of actual/IBW is common; we use IBW unless
    // underweight (actual < IBW), matching typical vanco practice.
    const cgWeight = actualKg < ibw ? actualKg : ibw;
    let crcl = ((140 - ageN) * cgWeight) / (72 * scrN);
    if (female) crcl *= 0.85;

    // Matzke population kinetics:
    //   kel (h^-1) = 0.00083 × CrCl(mL/min) + 0.0044
    //   Vd (L) = 0.7 L/kg × dosing weight
    const { weight: dosingWt, basis } = vancoDosingWeight(actualKg, ibw);
    const kel = 0.00083 * crcl + 0.0044;
    const vd = 0.7 * dosingWt;
    const halfLife = 0.693 / kel;
    // Clearance (L/h) = kel × Vd
    const cl = kel * vd;

    // Target AUC24 mid = 500 → total daily dose = AUC24 × CL
    const targetDailyDose = VANCO_AUC_MID * cl; // mg/day

    // Pick a practical interval from half-life, then round dose to 250 mg.
    const intervalOptions = [8, 12, 24, 36, 48];
    // Heuristic: interval ≈ closest practical to ~ (1.4 × t½) but capped.
    let interval = 12;
    if (halfLife > 22) interval = 48;
    else if (halfLife > 15) interval = 36;
    else if (halfLife > 9) interval = 24;
    else if (halfLife > 5) interval = 12;
    else interval = 8;
    // keep within options
    if (!intervalOptions.includes(interval)) interval = 12;

    const dosesPerDay = 24 / interval;
    const rawDose = targetDailyDose / dosesPerDay;
    let roundedDose = Math.round(rawDose / 250) * 250;

    // Practical safety caps (2020 ASHP/IDSA + common institutional protocols):
    //   • single dose typically ≤ 2000–2500 mg
    //   • total daily dose ≤ 4500 mg/day
    // Flag when the PK-target dose would exceed these so the user knows the
    // displayed regimen was capped (and measured-level monitoring is advised).
    const MAX_SINGLE_DOSE = 2500;
    const MAX_DAILY_DOSE = 4500;
    let doseCapped = false;
    if (roundedDose > MAX_SINGLE_DOSE) { roundedDose = MAX_SINGLE_DOSE; doseCapped = true; }
    if (roundedDose * dosesPerDay > MAX_DAILY_DOSE) {
      roundedDose = Math.floor((MAX_DAILY_DOSE / dosesPerDay) / 250) * 250;
      doseCapped = true;
    }
    const actualDailyDose = roundedDose * dosesPerDay;

    // Project AUC24 / Cmax / Cmin for the rounded regimen (1-compartment,
    // 1-hour infusion steady-state).
    const tInf = 1; // h
    const projAUC = actualDailyDose / cl;
    // Steady-state infusion model peak (end of infusion) & trough:
    //   Cmax = (Dose/tInf) / (CL) × (1 - e^-k·tInf) / (1 - e^-k·τ)
    const term = (roundedDose / tInf) / cl;
    const cmax = term * ((1 - Math.exp(-kel * tInf)) / (1 - Math.exp(-kel * interval)));
    const cmin = cmax * Math.exp(-kel * (interval - tInf));

    // Loading dose: 2020 ASHP/IDSA suggests 20–35 mg/kg ACTUAL body weight, not
    // exceeding 3000 mg, for seriously ill patients. Show the 25 mg/kg midpoint
    // plus the guideline range so the clinician can scale within it.
    const loading = Math.min(3000, Math.round((25 * actualKg) / 250) * 250);
    const loadingLow = Math.min(3000, Math.round((20 * actualKg) / 250) * 250);
    const loadingHigh = Math.min(3000, Math.round((35 * actualKg) / 250) * 250);

    const inRange = projAUC >= VANCO_AUC_LOW && projAUC <= VANCO_AUC_HIGH;

    return {
      crcl, ibw, dosingWt, basis, kel, vd, halfLife, cl,
      interval, roundedDose, actualDailyDose, projAUC, cmax, cmin,
      loading, loadingLow, loadingHigh, inRange, doseCapped,
    };
  })();

  // ── Two-level (measured) engine ──
  const [doseGiven, setDoseGiven] = useState('');
  const [interval2, setInterval2] = useState('12');
  const [peak, setPeak] = useState('');
  const [peakTime, setPeakTime] = useState('');   // h after END of infusion
  const [trough, setTrough] = useState('');
  const [troughTime, setTroughTime] = useState(''); // h after END of infusion
  const [infDur, setInfDur] = useState('1');

  const levels = (() => {
    const cP = parseFloat(peak);
    const cT = parseFloat(trough);
    const tP = parseFloat(peakTime);
    const tT = parseFloat(troughTime);
    const dose = parseFloat(doseGiven);
    const tau = parseFloat(interval2);
    const tInf = parseFloat(infDur);
    if (!(cP > 0 && cT > 0 && cP > cT && tT > tP && dose > 0 && tau > 0 && tInf > 0)) return null;

    // Elimination rate constant from the two measured levels.
    const kel = Math.log(cP / cT) / (tT - tP);
    const halfLife = 0.693 / kel;

    // Extrapolate to true Cmax (end of infusion, t=0) and Cmin (end of τ).
    const cmaxExtrap = cP / Math.exp(-kel * tP);
    const cminExtrap = cmaxExtrap * Math.exp(-kel * (tau - tInf));

    // AUC over one interval via the trapezoidal method on the 1-compartment
    // model (guideline analytic approach):
    //   AUC_infusion (during infusion, linear-up) ≈ (Cmax + C0)/2 × tInf, with
    //     C0 ≈ Cmin of prior interval (≈ cminExtrap at steady state)
    //   AUC_elimination = (Cmax − Cmin)/kel
    const aucInf = ((cmaxExtrap + cminExtrap) / 2) * tInf;
    const aucElim = (cmaxExtrap - cminExtrap) / kel;
    const aucTau = aucInf + aucElim;
    const auc24 = aucTau * (24 / tau);

    // Patient-specific clearance from AUC: CL = Dose(per interval) / AUC_tau
    const cl = dose / aucTau;

    // Recommend dose to hit AUC mid (500) at the same interval.
    const targetDaily = VANCO_AUC_MID * cl;
    const dosesPerDay = 24 / tau;
    const newDoseRaw = targetDaily / dosesPerDay;
    const newDose = Math.round(newDoseRaw / 250) * 250;

    const inRange = auc24 >= VANCO_AUC_LOW && auc24 <= VANCO_AUC_HIGH;

    return { kel, halfLife, cmaxExtrap, cminExtrap, auc24, cl, newDose, tau, inRange };
  })();

  // ── Bayesian (MAP) engine — Goti 2-compartment model ──
  // Uses the shared demographics (age/scr/sex/ht/wt) to build the Goti
  // population prior, then fits individual CL & Vc to 1–2 measured levels.
  // Supports a single trough — the headline capability of commercial Bayesian
  // dosing tools (InsightRX, PrecisePK, DoseMe all default to Goti for adults).
  const [bDose, setBDose] = useState('');
  const [bTau, setBTau] = useState('12');
  const [bInf, setBInf] = useState('1');
  const [bDial, setBDial] = useState(false);
  const [bUseTwo, setBUseTwo] = useState(false);
  const [bConc1, setBConc1] = useState('');
  const [bTime1, setBTime1] = useState('');   // h after END of infusion
  const [bConc2, setBConc2] = useState('');
  const [bTime2, setBTime2] = useState('');

  const bayesian = (() => {
    const dose = parseFloat(bDose);
    const tau = parseFloat(bTau);
    const tInf = parseFloat(bInf);
    if (!(ageN > 0 && actualKg > 0 && scrN > 0 && htIn > 0)) return { kind: 'needDemo' } as const;
    if (!(dose > 0 && tau > 0 && tInf > 0)) return { kind: 'incomplete' } as const;

    // Cockcroft-Gault CrCl for the Goti CL covariate. Per the model's published
    // data-handling rule, SCr is set to 1 mg/dL if <1 in patients >65 y.
    const ibw = vancoIBW(htIn, female);
    const cgWeight = actualKg < ibw ? actualKg : ibw;
    const scrAdj = scrN < 1 && ageN > 65 ? 1 : scrN;
    let crcl = ((140 - ageN) * cgWeight) / (72 * scrAdj);
    if (female) crcl *= 0.85;

    // Goti population typical values (the prior).
    const tv = gotiTypical(crcl, actualKg, bDial);
    const clPop = tv.cl;
    const vcPop = tv.vc;

    // Assemble measured levels.
    const levels: VancoLevel[] = [];
    const c1 = parseFloat(bConc1), t1 = parseFloat(bTime1);
    if (c1 > 0 && t1 >= 0) levels.push({ conc: c1, time: t1 });
    if (bUseTwo) {
      const c2 = parseFloat(bConc2), t2 = parseFloat(bTime2);
      if (c2 > 0 && t2 >= 0) levels.push({ conc: c2, time: t2 });
    }
    if (levels.length === 0) return { kind: 'incomplete' } as const;

    const fit = vancoMAPGoti({ clPop, vcPop, q: tv.q, vp: tv.vp, dose, tau, tInf, levels });
    if (!fit) return { kind: 'incomplete' } as const;

    // AUC24 from the Bayesian-fit clearance: AUC_τ = dose/CL (steady-state mass
    // balance), scaled to 24 h.
    const auc24 = vanco2cAUCtau(fit.cl, dose) * (24 / tau);
    const cmax = vanco2cSSConc(fit.cl, fit.vc, tv.q, tv.vp, dose, tau, tInf, 0);
    const cmin = vanco2cSSConc(fit.cl, fit.vc, tv.q, tv.vp, dose, tau, tInf, tau - tInf);

    // Dose to hit AUC mid (500) at the same interval.
    const targetDaily = VANCO_AUC_MID * fit.cl;
    const newDose = Math.round(targetDaily / (24 / tau) / 250) * 250;
    const inRange = auc24 >= VANCO_AUC_LOW && auc24 <= VANCO_AUC_HIGH;

    // Shrinkage indicator: how far the fit moved from the prior (informativeness
    // of the data). Small move = prior-dominated (typical for a single level).
    const clShift = ((fit.cl - clPop) / clPop) * 100;

    return {
      kind: 'result' as const,
      clPop, vcPop, crcl, fit, auc24, cmax, cmin, newDose, inRange, clShift,
      halfLife: 0.693 / (fit.cl / fit.vc),
      nLevels: levels.length,
    };
  })();

  const aucColor = (auc: number) =>
    auc < VANCO_AUC_LOW ? 'amber' : auc > VANCO_AUC_HIGH ? 'rose' : 'emerald';

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-start gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3.5">
        <Activity className="text-violet-400 shrink-0 mt-0.5" size={15} strokeWidth={2} />
        <p className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-violet-300">AUC-guided vancomycin dosing</span> per the
          2020 ASHP/IDSA/PIDS/SIDP consensus guideline. Target{' '}
          <span className="font-semibold text-white">AUC₂₄/MIC 400–600</span> (MIC assumed 1 mg/L).
          Choose <span className="font-semibold">Empiric</span> for first-dose population PK, or{' '}
          <span className="font-semibold">From Levels</span> to compute a measured AUC and dose adjustment.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {([
          ['empiric', 'Empiric'],
          ['levels', 'From Levels'],
          ['bayesian', 'Bayesian (MAP)'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
              mode === id
                ? 'bg-violet-500/15 border-violet-500/40 text-violet-200'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'empiric' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Age (yrs)</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="65" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>SCr (mg/dL)</label>
              <input type="number" step="0.1" value={scr} onChange={e => setScr(e.target.value)} placeholder="1.0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Height</label>
              <div className="relative">
                <input type="number" value={ht} onChange={e => setHt(e.target.value)} placeholder={htUnit === 'cm' ? '175' : '69'} className={`${inputCls} pr-12`} />
                <UnitToggle unit={htUnit} onClick={() => setHtUnit(u => (u === 'cm' ? 'in' : 'cm'))} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Weight</label>
              <div className="relative">
                <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder={wtUnit === 'kg' ? '80' : '176'} className={`${inputCls} pr-12`} />
                <UnitToggle unit={wtUnit} onClick={() => setWtUnit(u => (u === 'kg' ? 'lb' : 'kg'))} />
              </div>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors">
                <input type="checkbox" checked={female} onChange={e => setFemale(e.target.checked)} className="w-4 h-4 rounded accent-violet-500" />
                <span className="text-sm font-semibold text-slate-300">Female</span>
              </label>
            </div>
          </div>

          {empiric ? (
            <div className="space-y-4">
              {/* Headline recommendation */}
              <div className="p-4 rounded-xl border bg-violet-500/10 border-violet-500/30">
                <div className="text-[11px] font-bold uppercase tracking-wider text-violet-300 mb-1">
                  Recommended Maintenance Regimen
                </div>
                <div className="text-2xl font-bold text-white">
                  {empiric.roundedDose} mg <span className="text-base font-medium text-slate-300">IV q{empiric.interval}h</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ≈ {empiric.actualDailyDose} mg/day · Loading dose{' '}
                  <span className="font-semibold text-slate-200">{empiric.loading} mg</span>{' '}
                  (20–35 mg/kg → {empiric.loadingLow}–{empiric.loadingHigh} mg, max 3 g) for serious infection
                </div>
                {empiric.doseCapped && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-300/90 mt-2 pt-2 border-t border-white/10">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>
                      Maintenance dose capped at practical limits (≤2500 mg/dose, ≤4500 mg/day). The PK target
                      may require measured-level Bayesian monitoring to reach AUC 400–600 safely.
                    </span>
                  </div>
                )}
              </div>

              {/* Projected exposure */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-xl border text-center ${
                  empiric.inRange ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-amber-500/10 border-amber-500/25'
                }`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Proj. AUC₂₄</div>
                  <div className={`text-lg font-bold ${empiric.inRange ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {empiric.projAUC.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-slate-500">mg·h/L</div>
                </div>
                <div className="p-3 rounded-xl border bg-white/5 border-white/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Est. Peak</div>
                  <div className="text-lg font-bold text-slate-200">{empiric.cmax.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-500">mg/L</div>
                </div>
                <div className="p-3 rounded-xl border bg-white/5 border-white/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Est. Trough</div>
                  <div className="text-lg font-bold text-slate-200">{empiric.cmin.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-500">mg/L</div>
                </div>
              </div>

              {/* PK params */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Patient PK Parameters</div>
                {[
                  ['Est. CrCl (Cockcroft-Gault)', `${empiric.crcl.toFixed(1)} mL/min`],
                  ['Ideal body weight', `${empiric.ibw.toFixed(1)} kg`],
                  ['Dosing weight', `${empiric.dosingWt.toFixed(1)} kg (${empiric.basis})`],
                  ['Elimination rate (kₑ)', `${empiric.kel.toFixed(4)} h⁻¹`],
                  ['Half-life (t½)', `${empiric.halfLife.toFixed(1)} h`],
                  ['Volume of distribution', `${empiric.vd.toFixed(1)} L`],
                  ['Clearance', `${empiric.cl.toFixed(2)} L/h`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-300 font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
              {!empiric.inRange && (
                <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Projected AUC₂₄ is {empiric.projAUC < VANCO_AUC_LOW ? 'below' : 'above'} the 400–600 target with
                    the nearest practical 250 mg-rounded dose. Consider the adjacent interval or verify with measured levels.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <ResultBadge label="Recommended Dose" value={null} unit="" color="violet" />
          )}
        </>
      ) : mode === 'levels' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Dose given (mg)</label>
              <input type="number" value={doseGiven} onChange={e => setDoseGiven(e.target.value)} placeholder="1000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Interval τ (h)</label>
              <input type="number" value={interval2} onChange={e => setInterval2(e.target.value)} placeholder="12" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Infusion (h)</label>
              <input type="number" step="0.5" value={infDur} onChange={e => setInfDur(e.target.value)} placeholder="1" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Peak (mg/L)</label>
              <input type="number" step="0.1" value={peak} onChange={e => setPeak(e.target.value)} placeholder="25" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Peak time (h post-inf)</label>
              <input type="number" step="0.1" value={peakTime} onChange={e => setPeakTime(e.target.value)} placeholder="1" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trough (mg/L)</label>
              <input type="number" step="0.1" value={trough} onChange={e => setTrough(e.target.value)} placeholder="10" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trough time (h post-inf)</label>
              <input type="number" step="0.1" value={troughTime} onChange={e => setTroughTime(e.target.value)} placeholder="11" className={inputCls} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Enter two steady-state levels with their draw times measured from the END of the infusion.
            Peak is typically drawn 1–2 h post-infusion; trough just before the next dose.
          </p>

          {levels ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${
                levels.inRange ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
              }`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Measured AUC₂₄
                </div>
                <div className={`text-3xl font-bold ${
                  levels.inRange ? 'text-emerald-400' : levels.auc24 < VANCO_AUC_LOW ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {levels.auc24.toFixed(0)} <span className="text-base font-medium text-slate-400">mg·h/L</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {levels.inRange
                    ? 'Within target (400–600) — continue current regimen and monitor.'
                    : levels.auc24 < VANCO_AUC_LOW
                      ? 'Below target — underexposed; increase dose.'
                      : 'Above target — risk of nephrotoxicity; decrease dose.'}
                </div>
              </div>

              {!levels.inRange && (
                <div className="p-4 rounded-xl border bg-violet-500/10 border-violet-500/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-violet-300 mb-1">
                    Suggested Adjustment (same interval)
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {levels.newDose} mg <span className="text-base font-medium text-slate-300">IV q{levels.tau}h</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Targets AUC₂₄ ≈ 500 mg·h/L using the patient's measured clearance.</div>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Derived Kinetics</div>
                {[
                  ['Elimination rate (kₑ)', `${levels.kel.toFixed(4)} h⁻¹`],
                  ['Half-life (t½)', `${levels.halfLife.toFixed(1)} h`],
                  ['Extrapolated Cmax', `${levels.cmaxExtrap.toFixed(1)} mg/L`],
                  ['Extrapolated Cmin', `${levels.cminExtrap.toFixed(1)} mg/L`],
                  ['Clearance', `${levels.cl.toFixed(2)} L/h`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-300 font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ResultBadge label="Measured AUC₂₄" value={null} unit="" color="violet" />
          )}
        </>
      ) : (
        <>
          {/* Bayesian (MAP) — Goti 2-compartment prior from demographics + 1-2 levels */}
          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-white/[0.02] border border-white/10 rounded-xl p-3">
            <Activity size={13} className="shrink-0 mt-0.5 text-violet-400" />
            <span>
              Uses the <span className="font-semibold text-violet-300">Goti et al. (2018) two-compartment model</span> — the
              best-validated adult vancomycin prior (Broeker 2019, 31-model NONMEM comparison) and the adult default in
              commercial Bayesian platforms.
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Age (yrs)</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="65" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>SCr (mg/dL)</label>
              <input type="number" step="0.1" value={scr} onChange={e => setScr(e.target.value)} placeholder="1.0" className={inputCls} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors">
                <input type="checkbox" checked={female} onChange={e => setFemale(e.target.checked)} className="w-4 h-4 rounded accent-violet-500" />
                <span className="text-sm font-semibold text-slate-300">Female</span>
              </label>
            </div>
            <div>
              <label className={labelCls}>Height</label>
              <div className="relative">
                <input type="number" value={ht} onChange={e => setHt(e.target.value)} placeholder={htUnit === 'cm' ? '175' : '69'} className={`${inputCls} pr-12`} />
                <UnitToggle unit={htUnit} onClick={() => setHtUnit(u => (u === 'cm' ? 'in' : 'cm'))} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Weight</label>
              <div className="relative">
                <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder={wtUnit === 'kg' ? '80' : '176'} className={`${inputCls} pr-12`} />
                <UnitToggle unit={wtUnit} onClick={() => setWtUnit(u => (u === 'kg' ? 'lb' : 'kg'))} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Current dose (mg)</label>
              <input type="number" value={bDose} onChange={e => setBDose(e.target.value)} placeholder="1000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Interval τ (h)</label>
              <input type="number" value={bTau} onChange={e => setBTau(e.target.value)} placeholder="12" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Infusion (h)</label>
              <input type="number" step="0.5" value={bInf} onChange={e => setBInf(e.target.value)} placeholder="1" className={inputCls} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors w-fit">
            <input type="checkbox" checked={bDial} onChange={e => setBDial(e.target.checked)} className="w-4 h-4 rounded accent-violet-500" />
            <span className="text-sm font-semibold text-slate-300">On hemodialysis</span>
            <span className="text-[11px] text-slate-500">(applies Goti dialysis covariate)</span>
          </label>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Measured Level(s)</span>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input type="checkbox" checked={bUseTwo} onChange={e => setBUseTwo(e.target.checked)} className="w-4 h-4 rounded accent-violet-500" />
                Add second level
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Level 1 (mg/L)</label>
                <input type="number" step="0.1" value={bConc1} onChange={e => setBConc1(e.target.value)} placeholder="12 (trough)" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Time after inf. end (h)</label>
                <input type="number" step="0.1" value={bTime1} onChange={e => setBTime1(e.target.value)} placeholder="11" className={inputCls} />
              </div>
            </div>
            {bUseTwo && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Level 2 (mg/L)</label>
                  <input type="number" step="0.1" value={bConc2} onChange={e => setBConc2(e.target.value)} placeholder="25 (peak)" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Time after inf. end (h)</label>
                  <input type="number" step="0.1" value={bTime2} onChange={e => setBTime2(e.target.value)} placeholder="1" className={inputCls} />
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              A <span className="font-semibold text-slate-300">single trough</span> is sufficient — the population
              prior (built from the demographics above) supplies what one level can't determine. Times are measured
              from the END of the infusion; a trough drawn just before the next dose has time ≈ τ − infusion.
            </p>
          </div>

          {bayesian.kind === 'needDemo' ? (
            <div className="flex items-start gap-2 text-xs text-slate-400 bg-white/[0.02] border border-white/10 rounded-xl p-3">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-slate-500" />
              <span>Enter age, SCr, height, and weight above to build the population prior.</span>
            </div>
          ) : bayesian.kind === 'result' ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${
                bayesian.inRange ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
              }`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Bayesian AUC₂₄ ({bayesian.nLevels === 1 ? '1 level + prior' : '2 levels + prior'})
                </div>
                <div className={`text-3xl font-bold ${
                  bayesian.inRange ? 'text-emerald-400' : bayesian.auc24 < VANCO_AUC_LOW ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {bayesian.auc24.toFixed(0)} <span className="text-base font-medium text-slate-400">mg·h/L</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {bayesian.inRange
                    ? 'Within target (400–600) — continue current regimen and monitor.'
                    : bayesian.auc24 < VANCO_AUC_LOW
                      ? 'Below target — underexposed; increase dose.'
                      : 'Above target — nephrotoxicity risk; decrease dose.'}
                </div>
              </div>

              {!bayesian.inRange && (
                <div className="p-4 rounded-xl border bg-violet-500/10 border-violet-500/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-violet-300 mb-1">
                    Suggested Adjustment (same interval)
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {bayesian.newDose} mg <span className="text-base font-medium text-slate-300">IV q{bTau}h</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Targets AUC₂₄ ≈ 500 mg·h/L from the MAP-fit clearance.</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border bg-white/5 border-white/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pred. Peak</div>
                  <div className="text-lg font-bold text-slate-200">{bayesian.cmax.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-500">mg/L</div>
                </div>
                <div className="p-3 rounded-xl border bg-white/5 border-white/10 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pred. Trough</div>
                  <div className="text-lg font-bold text-slate-200">{bayesian.cmin.toFixed(1)}</div>
                  <div className="text-[10px] text-slate-500">mg/L</div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Goti MAP Estimates vs Population Prior</div>
                {[
                  ['Population CL (Goti prior)', `${bayesian.clPop.toFixed(2)} L/h`],
                  ['Individual CL (MAP fit)', `${bayesian.fit.cl.toFixed(2)} L/h`],
                  ['Population Vc (Goti prior)', `${bayesian.vcPop.toFixed(1)} L`],
                  ['Individual Vc (MAP fit)', `${bayesian.fit.vc.toFixed(1)} L`],
                  ['Half-life (t½, central)', `${bayesian.halfLife.toFixed(1)} h`],
                  ['CL shift from prior', `${bayesian.clShift >= 0 ? '+' : ''}${bayesian.clShift.toFixed(0)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-300 font-semibold tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ResultBadge label="Bayesian AUC₂₄" value={null} unit="" color="violet" />
          )}
        </>
      )}

      <p className="text-[10px] text-slate-600 leading-relaxed border-t border-white/5 pt-3">
        Decision-support estimate only. The Bayesian mode implements the Goti et al. (2018) two-compartment
        vancomycin population model (CL = 4.5·(CrCl/120)^0.8·0.7^DIAL; Vc = 58.4·(TBW/70)·0.5^DIAL; Q 6.5 L/h,
        Vp 38.4 L; ωCL 39.8%, ωVc 81.6%) with a combined proportional (20%) + additive (1 mg/L) residual error model.
        Estimates assume reasonably stable renal function; verify in critically ill, rapidly changing-renal,
        or morbidly obese patients. Not a substitute for a validated commercial Bayesian platform or clinical
        pharmacist review.
      </p>
    </div>
  );
}

// ── CrCl Calculator ────────────────────────────────────────────────────────────
function CrClCalculator() {
  const [age, setAge] = useState('');
  const [wt, setWt] = useState('');
  const [scr, setScr] = useState('');
  const [female, setFemale] = useState(false);
  const [wtUnit, setWtUnit] = useState('kg');

  const result = (() => {
    const wtKg = wtUnit === 'lb' ? parseFloat(wt) / 2.20462 : parseFloat(wt);
    if (parseFloat(age) > 0 && wtKg > 0 && parseFloat(scr) > 0) {
      let v = ((140 - parseFloat(age)) * wtKg) / (72 * parseFloat(scr));
      if (female) v *= 0.85;
      return v.toFixed(1);
    }
    return null;
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-sm">
      <p className="text-xs text-slate-500 leading-relaxed">
        Estimates glomerular filtration rate using serum creatinine, age, weight, and sex.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Age (yrs)</label>
          <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 65" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Weight</label>
          <div className="relative">
            <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder={wtUnit === 'kg' ? '70' : '154'} className={`${inputCls} pr-12`} />
            <UnitToggle unit={wtUnit} onClick={() => setWtUnit(u => u === 'kg' ? 'lb' : 'kg')} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className={labelCls}>SCr (mg/dL)</label>
          <input type="number" step="0.1" value={scr} onChange={e => setScr(e.target.value)} placeholder="e.g. 1.2" className={inputCls} />
        </div>
        <div className="pb-1">
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors">
            <input type="checkbox" checked={female} onChange={e => setFemale(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-sm font-semibold text-slate-300">Female</span>
          </label>
        </div>
      </div>
      <ResultBadge label="Est. CrCl" value={result} unit="mL/min" color="blue" />
    </div>
  );
}

// ── Body Weight & BMI (combined) ──────────────────────────────────────────────
// One height/weight/sex input set produces three derived metrics:
//   • IBW (Devine formula)
//   • Adjusted BW (used for many dose calcs when ABW > IBW)
//   • BMI + WHO category
// Combines what used to be two separate calculators (Adjusted BW, BMI Calculator)
// so the pharmacist only enters height and weight once.
function BodyMetricsCalculator() {
  const [ht, setHt] = useState('');
  const [wt, setWt] = useState('');
  const [female, setFemale] = useState(false);
  const [htUnit, setHtUnit] = useState('cm');
  const [wtUnit, setWtUnit] = useState('kg');

  const htInches = htUnit === 'cm' ? parseFloat(ht) / 2.54 : parseFloat(ht);
  const wtKg = wtUnit === 'lb' ? parseFloat(wt) / 2.20462 : parseFloat(wt);
  const hasHt = htInches > 0;
  const hasWt = wtKg > 0;

  // Devine IBW. Below 5 ft we floor at the base value (clinically common
  // convention; the formula's linear extrapolation becomes meaningless below
  // 60 inches).
  const ibwNum = hasHt
    ? (female ? 45.5 : 50) + Math.max(0, 2.3 * (htInches - 60))
    : null;

  // Adjusted BW only meaningful when ABW > IBW. Otherwise just report actual.
  const adjResult = (() => {
    if (ibwNum == null || !hasWt) return null;
    if (wtKg <= ibwNum) return `${wtKg.toFixed(1)} (actual ≤ IBW)`;
    return (ibwNum + 0.4 * (wtKg - ibwNum)).toFixed(1);
  })();

  // BMI (always uses ACTUAL body weight).
  const { bmiValue, bmiCategory } = (() => {
    if (!hasHt || !hasWt) return { bmiValue: null, bmiCategory: null };
    const htM = htInches * 0.0254;
    const b = wtKg / (htM * htM);
    let cat = '';
    if (b < 18.5) cat = 'Underweight';
    else if (b < 25) cat = 'Normal weight';
    else if (b < 30) cat = 'Overweight';
    else if (b < 35) cat = 'Obese Class I';
    else if (b < 40) cat = 'Obese Class II';
    else cat = 'Obese Class III (Morbid)';
    return { bmiValue: b.toFixed(1), bmiCategory: cat };
  })();

  const bmiColor: 'blue' | 'emerald' | 'amber' | 'rose' = (() => {
    if (!bmiValue) return 'blue';
    const v = parseFloat(bmiValue);
    if (v < 18.5) return 'blue';
    if (v < 25) return 'emerald';
    if (v < 30) return 'amber';
    return 'rose';
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-sm">
      <p className="text-xs text-slate-500 leading-relaxed">
        Single input → three metrics. <span className="text-slate-300 font-semibold">IBW</span> (Devine),{' '}
        <span className="text-slate-300 font-semibold">Adjusted BW</span> for obese patients, and{' '}
        <span className="text-slate-300 font-semibold">BMI</span> with WHO classification.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Height</label>
          <div className="relative">
            <input type="number" value={ht} onChange={e => setHt(e.target.value)} placeholder={htUnit === 'cm' ? '170' : '67'} className={`${inputCls} pr-12`} />
            <UnitToggle unit={htUnit} onClick={() => setHtUnit(u => u === 'cm' ? 'in' : 'cm')} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Actual Wt</label>
          <div className="relative">
            <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder={wtUnit === 'kg' ? '90' : '198'} className={`${inputCls} pr-12`} />
            <UnitToggle unit={wtUnit} onClick={() => setWtUnit(u => u === 'kg' ? 'lb' : 'kg')} />
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors w-fit">
        <input type="checkbox" checked={female} onChange={e => setFemale(e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
        <span className="text-sm font-semibold text-slate-300">Female Patient</span>
      </label>

      {ibwNum != null && (
        <div className="flex justify-between text-sm px-1">
          <span className="text-slate-500">IBW (Devine)</span>
          <span className="text-slate-300 font-semibold">{ibwNum.toFixed(1)} kg</span>
        </div>
      )}
      <ResultBadge label="Adjusted BW" value={adjResult} unit="kg" color="emerald" />
      <ResultBadge label="BMI" value={bmiValue} unit="kg/m²" color={bmiColor} />
      {bmiCategory && bmiValue && (
        <p className="text-xs text-slate-400 px-1 font-medium">{bmiCategory}</p>
      )}
    </div>
  );
}

// ── Iron Deficit (Ganzoni) ─────────────────────────────────────────────────────
function IronDeficitCalculator() {
  const [wt, setWt] = useState('');
  const [hgb, setHgb] = useState('');
  const [wtUnit, setWtUnit] = useState('kg');
  const TARGET_HGB = 15;

  const result = (() => {
    const wtKg = wtUnit === 'lb' ? parseFloat(wt) / 2.20462 : parseFloat(wt);
    if (wtKg > 0 && parseFloat(hgb) > 0) {
      const deficit = wtKg * (TARGET_HGB - parseFloat(hgb)) * 2.4 + 500;
      return deficit > 0 ? String(Math.round(deficit)) : '0';
    }
    return null;
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-sm">
      <p className="text-xs text-slate-500 leading-relaxed">
        Calculates total iron deficit using the Ganzoni equation (target Hgb fixed at {TARGET_HGB} g/dL).
      </p>
      <div>
        <label className={labelCls}>Weight</label>
        <div className="relative">
          <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder={wtUnit === 'kg' ? '75' : '165'} className={`${inputCls} pr-12`} />
          <UnitToggle unit={wtUnit} onClick={() => setWtUnit(u => u === 'kg' ? 'lb' : 'kg')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Actual Hgb</label>
          <input type="number" step="0.1" value={hgb} onChange={e => setHgb(e.target.value)} placeholder="e.g. 9.5" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Target Hgb</label>
          <input type="number" value={TARGET_HGB} disabled className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed" />
        </div>
      </div>
      <ResultBadge label="Total Iron Deficit" value={result} unit="mg" color="amber" />
    </div>
  );
}

// ── Corrected Calcium ──────────────────────────────────────────────────────────
function CorrectedCalciumCalculator() {
  const [ca, setCa] = useState('');
  const [alb, setAlb] = useState('');

  const result = (() => {
    if (parseFloat(ca) > 0 && parseFloat(alb) > 0) {
      return (parseFloat(ca) + 0.8 * (4.0 - parseFloat(alb))).toFixed(2);
    }
    return null;
  })();

  const flag = (() => {
    if (!result) return null;
    const v = parseFloat(result);
    if (v < 8.5) return { text: 'Hypocalcemia', color: 'text-blue-400' };
    if (v > 10.5) return { text: 'Hypercalcemia', color: 'text-rose-400' };
    return { text: 'Normal range', color: 'text-emerald-400' };
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-sm">
      <p className="text-xs text-slate-500 leading-relaxed">
        Adjusts serum calcium for low albumin levels. Formula: Ca + 0.8 × (4.0 − Albumin).
      </p>
      <div>
        <label className={labelCls}>Serum Calcium (mg/dL)</label>
        <input type="number" step="0.1" value={ca} onChange={e => setCa(e.target.value)} placeholder="e.g. 8.2" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Serum Albumin (g/dL)</label>
        <input type="number" step="0.1" value={alb} onChange={e => setAlb(e.target.value)} placeholder="e.g. 2.8" className={inputCls} />
      </div>
      <ResultBadge label="Corrected Ca" value={result} unit="mg/dL" color="rose" />
      {flag && result && (
        <p className={`text-xs font-semibold ${flag.color} px-1`}>{flag.text} (normal 8.5–10.5 mg/dL)</p>
      )}
    </div>
  );
}

// ── CADD Bag Calculator ────────────────────────────────────────────────────────
function CADDCalculator() {
  const [selectedDrug, setSelectedDrug] = useState('');
  const [dose, setDose] = useState(4500);
  const [freq, setFreq] = useState(8);
  const [conc, setConc] = useState(33.75);
  const [kvo, setKvo] = useState(2);
  const [lineVol, setLineVol] = useState(20);

  const handleDrugChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedDrug(name);
    if (name && CADD_PRESETS[name]) {
      const p = CADD_PRESETS[name];
      setDose(p.dose);
      setFreq(p.freq);
      setConc(p.conc);
      setKvo(p.kvo);
    }
  };

  const freqPerDay = freq > 0 ? 24 / freq : 0;

  // Selected preset (if any) drives the displayed units and the workbook hint.
  const preset = selectedDrug ? CADD_PRESETS[selectedDrug] : undefined;
  const concUnit = preset?.unit ?? 'mg/mL';        // e.g. "mg/mL" or "units/mL"
  const massUnit = concUnit.split('/')[0];          // e.g. "mg" or "units"

  const getPracticalBagVol = (days: number) => {
    const drugV = conc > 0 ? (dose * freqPerDay * days) / conc : 0;
    const kvoV = kvo * 24 * days;
    return Math.ceil((drugV + kvoV + lineVol) / 10) * 10;
  };

  const tableInputCls =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors';

  return (
    <div className="animate-in fade-in duration-300 flex flex-col lg:flex-row gap-8">
      {/* Left – parameters */}
      <div className="w-full lg:w-72 flex-shrink-0 space-y-5">
        <p className="text-xs text-slate-500 leading-relaxed">
          Calculates CADD bag volumes and doses for 1–5 day durations. Pick a drug to pull its concentration and
          KVO from the CADD bag calculator workbook, then enter the patient&apos;s dose and frequency.
        </p>

        {/* Drug preset */}
        <div>
          <label className={labelCls}>Antibiotic Preset</label>
          <div className="relative">
            <select
              value={selectedDrug}
              onChange={handleDrugChange}
              className="appearance-none w-full px-5 py-3.5 pr-12 border border-white/5 rounded-full focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] cursor-pointer"
            >
              <option className="bg-[#121212] text-white" value="">Custom / None</option>
              {Object.keys(CADD_PRESETS).sort().map(name => (
                <option className="bg-[#121212] text-white" key={name} value={name}>{name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-slate-400 shadow-sm border border-white/5">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Workbook values for the selected drug */}
          {preset && (
            <div className="mt-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Concentration</span>
                <span className="text-emerald-300 font-semibold">{preset.concLabel} {preset.unit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">KVO</span>
                <span className="text-emerald-300 font-semibold">{preset.kvo} mL/hr</span>
              </div>
              {preset.note && (
                <p className="text-[11px] text-amber-300/90 leading-relaxed pt-1.5 border-t border-white/10">
                  {preset.note}
                </p>
              )}
              <p className="text-[10px] text-slate-500 pt-0.5">From CADD bag calculator workbook. Adjust below if needed.</p>
            </div>
          )}
        </div>

        {/* Dose & Freq */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Dose ({massUnit})</label>
            <input type="number" value={dose} onChange={e => setDose(parseFloat(e.target.value) || 0)} className={tableInputCls} />
          </div>
          <div>
            <label className={labelCls}>Freq (q_hr)</label>
            <input type="number" value={freq} onChange={e => setFreq(parseFloat(e.target.value) || 0)} className={tableInputCls} />
          </div>
        </div>

        {/* Concentration */}
        <div>
          <label className={labelCls}>Concentration ({concUnit})</label>
          <input type="number" step="0.01" value={conc} onChange={e => setConc(parseFloat(e.target.value) || 0)} className={tableInputCls} />
        </div>

        {/* KVO & Line Vol */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
          <div>
            <label className={labelCls}>KVO (mL/hr)</label>
            <input type="number" step="0.1" value={kvo} onChange={e => setKvo(parseFloat(e.target.value) || 0)} className={tableInputCls} />
          </div>
          <div>
            <label className={labelCls}>Line Vol (mL)</label>
            <input type="number" value={lineVol} onChange={e => setLineVol(parseFloat(e.target.value) || 0)} className={tableInputCls} />
          </div>
        </div>

        {/* Derived info */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Doses / day</span>
            <span className="text-white font-semibold">{freqPerDay.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Daily drug vol</span>
            <span className="text-white font-semibold">
              {conc > 0 ? ((dose * freqPerDay) / conc).toFixed(1) : '—'} mL
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Daily drug amount</span>
            <span className="text-white font-semibold">{(dose * freqPerDay).toLocaleString(undefined, { maximumFractionDigits: 0 })} {massUnit}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Daily KVO vol</span>
            <span className="text-white font-semibold">{(kvo * 24).toFixed(1)} mL</span>
          </div>
        </div>
      </div>

      {/* Right – results table */}
      <div className="flex-1 min-w-0">
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-400" />
            <h4 className="font-semibold text-white text-sm">Requirements by Duration</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[520px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Metric</th>
                  {DAYS.map(d => (
                    <th key={d} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center border-l border-white/5">
                      {d}d
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/5">
                {/* Drug volume */}
                <tr>
                  <td className="px-5 py-3 text-slate-500 text-xs">Drug Vol (mL)</td>
                  {DAYS.map(d => (
                    <td key={d} className="px-4 py-3 text-center border-l border-white/5 text-slate-400 text-xs">
                      {conc > 0 ? ((dose * freqPerDay * d) / conc).toFixed(1) : '—'}
                    </td>
                  ))}
                </tr>
                {/* KVO volume */}
                <tr>
                  <td className="px-5 py-3 text-slate-500 text-xs">KVO Vol (mL)</td>
                  {DAYS.map(d => (
                    <td key={d} className="px-4 py-3 text-center border-l border-white/5 text-slate-400 text-xs">
                      {(kvo * 24 * d).toFixed(1)}
                    </td>
                  ))}
                </tr>
                {/* Line volume */}
                <tr>
                  <td className="px-5 py-3 text-slate-500 text-xs">Line Vol (mL)</td>
                  {DAYS.map(d => (
                    <td key={d} className="px-4 py-3 text-center border-l border-white/5 text-slate-400 text-xs">
                      {lineVol}
                    </td>
                  ))}
                </tr>
                {/* Practical bag volume — highlighted */}
                <tr className="bg-emerald-500/5">
                  <td className="px-5 py-3 align-top">
                    <span className="text-white font-bold text-sm block">Bag Volume (mL)</span>
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wide">Rounded to 10 mL</span>
                  </td>
                  {DAYS.map(d => (
                    <td key={d} className="px-4 py-3 text-center border-l border-white/5 text-white font-bold text-lg">
                      {getPracticalBagVol(d)}
                    </td>
                  ))}
                </tr>
                {/* Final bag dose */}
                <tr className="bg-white/[0.02]">
                  <td className="px-5 py-3 align-top">
                    <span className="text-emerald-400 font-bold text-sm block">Final Bag Dose</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Adjusted for volume</span>
                  </td>
                  {DAYS.map(d => {
                    const amt = getPracticalBagVol(d) * conc;
                    // Only convert to grams for mass-based drugs; unit-based drugs
                    // (e.g. Penicillin G) stay in units.
                    const display = massUnit === 'mg' && amt >= 1000
                      ? `${(amt / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} g`
                      : `${Math.round(amt).toLocaleString()} ${massUnit}`;
                    return (
                      <td key={d} className="px-4 py-3 text-center border-l border-white/5 align-top">
                        <span className="text-emerald-400 font-bold text-base block">{display}</span>
                        <span className="text-[10px] text-slate-500 block">{Math.round(amt).toLocaleString()} {massUnit}</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ESA Dosing for Anemia of CKD ────────────────────────────────────────────────
// Three workflows:
//   • Initiation  — Week 0 eligibility + starting dose (darbepoetin / epoetin alfa-epbx)
//   • Titration   — Week 5+ dose adjustment from Hgb response (4 decision rows)
//   • Iron        — IV iron repletion thresholds from TSAT + ferritin
//
// Decision-support only. Where the decision table leaves a gap the tool flags it
// rather than inventing a recommendation.

const ESA_SYRINGE = [25, 40, 60, 100, 150, 200, 300, 500] as const; // Aranesp syringe sizes (mcg)
const EPO_STRENGTHS = [2000, 3000, 4000, 10000, 20000, 40000] as const; // common Retacrit vial strengths (units)

type EsaAgentId = 'darbepoetin' | 'epoetin';

const ESA_AGENTS: Record<EsaAgentId, {
  label: string; brand: string; note: string; unit: 'mcg' | 'units';
  sizeLabel: string; weightBased: boolean; initSchedule: string;
  initDosePerKg?: number; initDoseFixed?: number;
}> = {
  darbepoetin: {
    label: 'Darbepoetin alfa', brand: 'Aranesp', note: 'Preferred ESA agent',
    unit: 'mcg', sizeLabel: 'syringe', weightBased: true,
    initDosePerKg: 0.45, initSchedule: 'Week 1 — 0.45 mcg/kg SQ',
  },
  epoetin: {
    label: 'Epoetin alfa-epbx', brand: 'Retacrit', note: 'Alternative ESA agent',
    unit: 'units', sizeLabel: 'vial', weightBased: false,
    initDoseFixed: 10000, initSchedule: 'Weeks 1 & 3 — 10,000 units SQ',
  },
};

const esaNearestSyringe = (v: number): number =>
  ESA_SYRINGE.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), ESA_SYRINGE[0]);

const esaFmtDose = (v: number, unit: 'mcg' | 'units'): string =>
  unit === 'units' ? `${Math.round(v).toLocaleString()} units` : `${v % 1 === 0 ? v : v.toFixed(1)} mcg`;

type EsaAction = 'increase' | 'decrease' | 'continue' | 'hold' | 'judgment';

// Week-5+ titration decision. Safety-ordered so the hold/decrease ceilings take
// precedence over the increase rules (which only apply below 10 / 10.6 g/dL).
function esaTitration(agentId: EsaAgentId, currentHgb: number, priorHgb: number | null, dose: number | null) {
  if (!(currentHgb > 0)) return null;
  const agent = ESA_AGENTS[agentId];
  const hasPrior = priorHgb != null && priorHgb > 0;
  const rise = hasPrior ? currentHgb - priorHgb! : null;

  let action: EsaAction;
  let color: string;
  let rule: string;
  let factor: number | null = null; // multiplier applied to current dose (null = no new dose, e.g. hold)

  if (currentHgb > 11) {
    action = 'hold'; color = 'rose';
    rule = 'Hgb > 11 g/dL → Hold ESA.';
  } else if (currentHgb >= 10.6) {
    action = 'decrease'; color = 'amber'; factor = 0.75;
    rule = `Hgb ≥ 10.6 g/dL → Decrease dose by 25% (round to nearest ${agent.sizeLabel} size).`;
  } else {
    // Hgb < 10.6 — the increase / continue rules need the 4-week Hgb change.
    if (!hasPrior) return { incomplete: true as const };
    if (rise! > 1) {
      action = 'continue'; color = 'emerald'; factor = 1;
      rule = 'Hgb rise > 1 g/dL and Hgb < 10.6 g/dL → Continue the same dose.';
    } else if (currentHgb < 10) {
      action = 'increase'; color = 'blue'; factor = 1.25;
      rule = `Hgb rise ≤ 1 g/dL and Hgb < 10 g/dL → Increase dose by 25% (round to nearest ${agent.sizeLabel} size).`;
    } else {
      // 10 ≤ Hgb < 10.6 with rise ≤ 1 g/dL — gap between the four standard decision rows.
      action = 'judgment'; color = 'violet'; factor = 1;
      rule = 'Hgb 10–10.6 g/dL with a rise ≤ 1 g/dL falls in a gap between the four standard decision rows. Hgb is approaching target — continuing the current dose is the conservative default; confirm with the provider.';
    }
  }

  // New dose (only when we have a factor and a current dose).
  let rawNew: number | null = null;
  let roundedNew: number | null = null;
  let multiSyringe = false;
  if (factor != null && dose != null && dose > 0) {
    rawNew = dose * factor;
    if (agentId === 'darbepoetin') {
      if (rawNew > 500) { multiSyringe = true; roundedNew = rawNew; }
      else roundedNew = esaNearestSyringe(rawNew);
    } else {
      roundedNew = Math.round(rawNew / 100) * 100; // epoetin: nearest 100 units; combine vials per stock
    }
  }

  return { incomplete: false as const, action, color, rule, factor, rawNew, roundedNew, multiSyringe, agent };
}

// IV iron repletion decision from TSAT (%) and ferritin (ng/mL).
function esaIron(tsat: number, ferritin: number) {
  if (!(tsat > 0 && ferritin > 0)) return null;
  if (ferritin > 1000 || tsat > 30) {
    return {
      action: 'none' as const, color: 'amber',
      title: 'No iron — assess for iron overload',
      detail: 'Ferritin > 1000 ng/mL and/or TSAT > 30%. Hold iron supplementation; provider documentation required for iron-overload states.',
      regimens: [] as string[],
    };
  }
  if (tsat < 20 && ferritin > 800) {
    return {
      action: 'discretion' as const, color: 'violet',
      title: 'Iron per provider discretion',
      detail: 'TSAT < 20% with ferritin 800–1000 ng/mL. Iron at provider discretion.',
      regimens: [] as string[],
    };
  }
  const replace = (tsat < 20 && ferritin < 800) || (tsat >= 20 && tsat <= 30 && ferritin < 100);
  if (replace) {
    return {
      action: 'replace' as const, color: 'blue',
      title: 'IV iron repletion indicated',
      detail: tsat < 20 ? 'TSAT < 20% with ferritin < 800 ng/mL.' : 'TSAT 20–30% with ferritin < 100 ng/mL.',
      regimens: [
        'Ferumoxytol (Feraheme) 510 mg IV weekly × 2 doses',
        'Iron sucrose 200 mg IV every 48 h × 5 doses',
        'Ferric carboxymaltose (Injectafer) 750 mg IV weekly × 2 doses',
      ],
    };
  }
  return {
    action: 'adequate' as const, color: 'emerald',
    title: 'Iron stores adequate',
    detail: 'Values do not meet IV iron repletion thresholds. No iron supplementation indicated at this time; recheck per the monitoring schedule.',
    regimens: [] as string[],
  };
}

const ESA_CARD_COLORS: Record<string, string> = {
  blue:    'bg-blue-500/10 border-blue-500/30',
  emerald: 'bg-emerald-500/10 border-emerald-500/30',
  amber:   'bg-amber-500/10 border-amber-500/30',
  rose:    'bg-rose-500/10 border-rose-500/30',
  violet:  'bg-violet-500/10 border-violet-500/30',
};
const ESA_TEXT_COLORS: Record<string, string> = {
  blue: 'text-blue-300', emerald: 'text-emerald-300', amber: 'text-amber-300',
  rose: 'text-rose-300', violet: 'text-violet-300',
};

const ESA_ACTION_META: Record<EsaAction, { label: string; Icon: typeof ArrowUp }> = {
  increase: { label: 'Increase dose 25%', Icon: ArrowUp },
  decrease: { label: 'Decrease dose 25%', Icon: ArrowDown },
  continue: { label: 'Continue same dose', Icon: Check },
  hold:     { label: 'Hold ESA', Icon: Pause },
  judgment: { label: 'Clinician judgment', Icon: AlertTriangle },
};

// Week-0 eligibility criteria (inclusion all-met + no exclusion present).
const ESA_INCLUSION = [
  'Hgb < 10.0 g/dL, drawn within 7 days of the dose',
  'Ferritin ≥ 100 ng/mL OR TSAT ≥ 20% (within 3 months)',
  'Vitamin B-12 and folate within normal limits (within 3 months)',
  'Serum creatinine within 30 days; Stage III+ CKD (GFR < 60) and NOT on dialysis',
  'Physician order for pharmacist to manage ESA therapy',
];
const ESA_EXCLUSION = [
  'Uncontrolled hypertension (> 180/100)',
  'Active bleeding',
  'Cancer treatment for malignancy with curative intent',
  'Bone marrow fibrosis',
  'Erythropoietin resistance (neutralizing antibodies)',
];

function ESADosingCalculator() {
  const [mode, setMode] = useState<'initiation' | 'titration' | 'iron'>('titration');
  const [agentId, setAgentId] = useState<EsaAgentId>('darbepoetin');
  const agent = ESA_AGENTS[agentId];

  // Initiation state
  const [wt, setWt] = useState('');
  const [wtUnit, setWtUnit] = useState('kg');
  const [inclusion, setInclusion] = useState<boolean[]>(() => ESA_INCLUSION.map(() => false));
  const [exclusion, setExclusion] = useState<boolean[]>(() => ESA_EXCLUSION.map(() => false));

  // Titration state
  const [curHgb, setCurHgb] = useState('');
  const [priorHgb, setPriorHgb] = useState('');
  const [curDose, setCurDose] = useState('');

  // Iron state
  const [tsat, setTsat] = useState('');
  const [ferritin, setFerritin] = useState('');

  // ── Initiation derived ──
  const wtKg = wtUnit === 'lb' ? parseFloat(wt) / 2.20462 : parseFloat(wt);
  const initDose = (() => {
    if (agent.weightBased) {
      if (!(wtKg > 0)) return null;
      const raw = agent.initDosePerKg! * wtKg;
      return { raw, rounded: esaNearestSyringe(raw) };
    }
    return { raw: agent.initDoseFixed!, rounded: agent.initDoseFixed! };
  })();
  const eligible = inclusion.every(Boolean) && exclusion.every(v => !v);
  const anyEligibilityTouched = inclusion.some(Boolean) || exclusion.some(Boolean);

  // ── Titration derived ──
  const titration = esaTitration(
    agentId,
    parseFloat(curHgb),
    priorHgb ? parseFloat(priorHgb) : null,
    curDose ? parseFloat(curDose) : null,
  );

  // ── Iron derived ──
  const iron = esaIron(parseFloat(tsat), parseFloat(ferritin));

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-start gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3.5">
        <Droplets className="text-violet-400 shrink-0 mt-0.5" size={15} strokeWidth={2} />
        <p className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-violet-300">ESA dosing for anemia of CKD</span> — goal: lowest ESA dose that keeps Hgb just
          high enough to avoid transfusion. Choose a workflow below.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {([
          ['initiation', 'Initiation'],
          ['titration', 'Dose Titration'],
          ['iron', 'Iron Repletion'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
              mode === id
                ? 'bg-violet-500/15 border-violet-500/40 text-violet-200'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Agent toggle (initiation + titration) */}
      {mode !== 'iron' && (
        <div className="flex gap-2">
          {(Object.keys(ESA_AGENTS) as EsaAgentId[]).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setAgentId(id)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                agentId === id
                  ? 'bg-white/10 border-white/25 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              {ESA_AGENTS[id].label}
              <span className="block text-[10px] font-normal opacity-70">{ESA_AGENTS[id].brand} · {ESA_AGENTS[id].note}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── INITIATION ── */}
      {mode === 'initiation' && (
        <div className="space-y-4">
          {agent.weightBased ? (
            <div className="max-w-xs">
              <label className={labelCls}>Weight</label>
              <div className="relative">
                <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder={wtUnit === 'kg' ? '70' : '154'} className={`${inputCls} pr-12`} />
                <UnitToggle unit={wtUnit} onClick={() => setWtUnit(u => (u === 'kg' ? 'lb' : 'kg'))} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Epoetin alfa-epbx initiation is a fixed dose — no weight needed.</p>
          )}

          {/* Starting dose */}
          <div className="p-4 rounded-xl border bg-violet-500/10 border-violet-500/30">
            <div className="text-[11px] font-bold uppercase tracking-wider text-violet-300 mb-1">
              Starting Dose — {agent.label} ({agent.brand})
            </div>
            {initDose ? (
              <>
                <div className="text-2xl font-bold text-white">
                  {agent.weightBased
                    ? `${esaNearestSyringe(initDose.raw)} mcg`
                    : esaFmtDose(initDose.rounded, agent.unit)}
                  <span className="text-base font-medium text-slate-300"> SQ</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {agent.initSchedule}
                  {agent.weightBased && (
                    <> · calculated {initDose.raw.toFixed(1)} mcg → nearest syringe {esaNearestSyringe(initDose.raw)} mcg</>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500 italic">Enter weight to compute the starting dose.</div>
            )}
          </div>

          {/* Eligibility checklist */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inclusion criteria (all required)</div>
            <div className="space-y-2">
              {ESA_INCLUSION.map((c, i) => (
                <label key={i} className="flex items-start gap-2.5 cursor-pointer text-[13px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={inclusion[i]}
                    onChange={e => setInclusion(prev => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="w-4 h-4 rounded accent-emerald-500 mt-0.5 shrink-0"
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-2 border-t border-white/10">Exclusion criteria (none may be present)</div>
            <div className="space-y-2">
              {ESA_EXCLUSION.map((c, i) => (
                <label key={i} className="flex items-start gap-2.5 cursor-pointer text-[13px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={exclusion[i]}
                    onChange={e => setExclusion(prev => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="w-4 h-4 rounded accent-rose-500 mt-0.5 shrink-0"
                  />
                  <span>{c} <span className="text-[11px] text-slate-500">(check if present)</span></span>
                </label>
              ))}
            </div>
          </div>

          {anyEligibilityTouched && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${eligible ? ESA_CARD_COLORS.emerald : ESA_CARD_COLORS.amber}`}>
              {eligible
                ? <Check size={16} className="text-emerald-300 shrink-0 mt-0.5" />
                : <AlertTriangle size={16} className="text-amber-300 shrink-0 mt-0.5" />}
              <p className="text-[13px] text-slate-200">
                {eligible
                  ? 'All inclusion criteria met and no exclusions present — eligible to initiate ESA therapy.'
                  : 'Not yet eligible: confirm every inclusion criterion is met and that no exclusion criteria are present before initiating.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TITRATION ── */}
      {mode === 'titration' && (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Week 5 and every 4 weeks thereafter. Enter the current Hgb, the Hgb from ~4 weeks ago (to derive the
            rise), and the current dose. Decreases may be made at any time; <span className="text-slate-300 font-semibold">increases no more often than every 4 weeks</span>.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Current Hgb (g/dL)</label>
              <input type="number" step="0.1" value={curHgb} onChange={e => setCurHgb(e.target.value)} placeholder="9.8" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Prior Hgb (g/dL)</label>
              <input type="number" step="0.1" value={priorHgb} onChange={e => setPriorHgb(e.target.value)} placeholder="9.2" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Current dose ({agent.unit})</label>
              <input type="number" value={curDose} onChange={e => setCurDose(e.target.value)} placeholder={agent.unit === 'mcg' ? '40' : '10000'} className={inputCls} />
            </div>
          </div>

          {titration && !titration.incomplete ? (
            <div className="space-y-4">
              {(() => {
                const meta = ESA_ACTION_META[titration.action];
                const ActionIcon = meta.Icon;
                return (
                  <div className={`p-4 rounded-xl border ${ESA_CARD_COLORS[titration.color]}`}>
                    <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${ESA_TEXT_COLORS[titration.color]} mb-1.5`}>
                      <ActionIcon size={14} /> Recommendation
                    </div>
                    <div className="text-2xl font-bold text-white">{meta.label}</div>

                    {/* New dose / instruction */}
                    {titration.action === 'hold' ? (
                      <div className="text-xs text-slate-400 mt-1.5">
                        Hold the dose and recheck Hgb. Resume at a reduced dose once Hgb falls below target, per provider.
                      </div>
                    ) : titration.roundedNew != null ? (
                      <div className="text-sm text-slate-200 mt-1.5">
                        New dose:{' '}
                        <span className="font-bold text-white">
                          {agentId === 'darbepoetin' && !titration.multiSyringe
                            ? `${titration.roundedNew} mcg`
                            : esaFmtDose(titration.roundedNew, agent.unit)}
                        </span>
                        {titration.action !== 'continue' && titration.action !== 'judgment' && titration.rawNew != null && (
                          <span className="text-slate-400">
                            {' '}(calculated {esaFmtDose(titration.rawNew, agent.unit)}
                            {agentId === 'darbepoetin' && !titration.multiSyringe ? ` → nearest ${agent.sizeLabel}` : ''})
                          </span>
                        )}
                        {agentId === 'epoetin' && (titration.action === 'increase' || titration.action === 'decrease') && (
                          <span className="block text-[11px] text-slate-500 mt-0.5">Round to the nearest available vial size / combination per pharmacy stock.</span>
                        )}
                        {titration.multiSyringe && (
                          <span className="block text-[11px] text-amber-300/90 mt-0.5">Exceeds the 500 mcg syringe — combine syringes or verify with provider.</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic mt-1.5">Enter the current dose to compute the adjusted dose.</div>
                    )}
                  </div>
                );
              })()}

              {/* Rationale */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Protocol rule applied</div>
                <p className="text-slate-300 leading-relaxed">{titration.rule}</p>
                {titration.rawNew != null && (
                  <div className="flex justify-between pt-1.5 border-t border-white/10">
                    <span className="text-slate-500">Hgb change (4 wk)</span>
                    <span className="text-slate-300 font-semibold tabular-nums">
                      {priorHgb ? `${(parseFloat(curHgb) - parseFloat(priorHgb)) >= 0 ? '+' : ''}${(parseFloat(curHgb) - parseFloat(priorHgb)).toFixed(1)} g/dL` : '—'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-white/[0.02] border border-white/10 rounded-xl p-3">
                <Activity size={13} className="shrink-0 mt-0.5 text-violet-400" />
                <span>
                  <span className="font-semibold text-slate-300">Week 12 assessment:</span> if Hgb has not risen above
                  10 g/dL over 12 weeks and transfusions have not decreased, notify the provider and discuss discharge
                  from service. Consider extending to every-6-week intervals to smooth Hgb fluctuations.
                </span>
              </div>
            </div>
          ) : titration && titration.incomplete ? (
            <div className="flex items-start gap-2 text-xs text-slate-400 bg-white/[0.02] border border-white/10 rounded-xl p-3">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-slate-500" />
              <span>Hgb is below 10.6 g/dL — enter the prior (≈4-week) Hgb to determine the rise and the correct adjustment.</span>
            </div>
          ) : (
            <ResultBadge label="Recommendation" value={null} unit="" color="violet" />
          )}
        </div>
      )}

      {/* ── IRON REPLETION ── */}
      {mode === 'iron' && (
        <div className="space-y-4">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            IV iron repletion thresholds based on TSAT and ferritin. ESA therapy may continue during iron
            supplementation with appropriate documentation.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className={labelCls}>TSAT / Fe Sat (%)</label>
              <input type="number" step="1" value={tsat} onChange={e => setTsat(e.target.value)} placeholder="18" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ferritin (ng/mL)</label>
              <input type="number" value={ferritin} onChange={e => setFerritin(e.target.value)} placeholder="90" className={inputCls} />
            </div>
          </div>

          {iron ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${ESA_CARD_COLORS[iron.color]}`}>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${ESA_TEXT_COLORS[iron.color]} mb-1`}>Recommendation</div>
                <div className="text-xl font-bold text-white">{iron.title}</div>
                <div className="text-xs text-slate-400 mt-1">{iron.detail}</div>
                {iron.regimens.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {iron.regimens.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-slate-200">
                        <span className="text-slate-500 mt-0.5">•</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-white/[0.02] border border-white/10 rounded-xl p-3">
                <Activity size={13} className="shrink-0 mt-0.5 text-violet-400" />
                <span>Re-check iron levels 1–2 weeks after completing the iron course; allow no fewer than 1 week between an iron dose and the lab draw.</span>
              </div>
            </div>
          ) : (
            <ResultBadge label="Recommendation" value={null} unit="" color="violet" />
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-600 leading-relaxed border-t border-white/5 pt-3">
        Decision-support tool for ESA dosing in CKD-related anemia. Not a substitute for prescribing information
        or clinical pharmacist and provider judgment. Confirm all labs are current and within the required draw
        windows before acting.
      </p>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function ClinicalCalculators() {
  const [activeCalc, setActiveCalc] = useState('cadd');
  const active = CALCULATORS.find(c => c.id === activeCalc);

  return (
    <div className="pt-32 pb-16 px-6 md:px-12 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <div className="bg-violet-500/10 p-2.5 rounded-xl border border-violet-500/20">
            <Calculator className="text-violet-400" size={20} strokeWidth={2} />
          </div>
          Clinical Calculators
        </h1>
        <p className="text-[15px] text-slate-400 mt-2">
          Evidence-based dosing and pharmacokinetic tools for clinical decision support.
        </p>
      </div>

      {/* Calculator selector */}
      <div className="mb-8 flex flex-wrap gap-2">
        {CALCULATORS.map(calc => (
          <button
            key={calc.id}
            onClick={() => setActiveCalc(calc.id)}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all ${
              activeCalc === calc.id
                ? 'bg-white/10 text-white shadow-sm border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {calc.label}
          </button>
        ))}
      </div>

      {/* Active calculator panel */}
      <div className="glass-panel p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
          <div className="bg-violet-500/10 p-1.5 rounded-lg border border-violet-500/20">
            <SlidersHorizontal className="text-violet-400 w-4 h-4" />
          </div>
          <h2 className="font-bold text-white">{active?.label}</h2>
        </div>

        {activeCalc === 'idsa-abx' && <IDSAAntibioticAdvisor />}
        {activeCalc === 'cadd'    && <CADDCalculator />}
        {activeCalc === 'ivig'   && <IVIGRateCalculator />}
        {activeCalc === 'biolrate' && <InfusionRateCalculator />}
        {activeCalc === 'vanco'  && <VancomycinAUCCalculator />}
        {activeCalc === 'crcl'   && <CrClCalculator />}
        {activeCalc === 'bodywt' && <BodyMetricsCalculator />}
        {activeCalc === 'iron'   && <IronDeficitCalculator />}
        {activeCalc === 'esa'    && <ESADosingCalculator />}
        {activeCalc === 'calcium'&& <CorrectedCalciumCalculator />}
      </div>
    </div>
  );
}
