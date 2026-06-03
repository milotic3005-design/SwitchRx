'use client';

import { useState } from 'react';
import { Calculator, SlidersHorizontal, ListChecks, ChevronDown, Activity, AlertTriangle } from 'lucide-react';
import { IVIGRateCalculator } from './IVIGRateCalculator';
import { InfusionRateCalculator } from './InfusionRateCalculator';
import { IDSAAntibioticAdvisor } from './IDSAAntibioticAdvisor';

// ── CADD drug presets ──────────────────────────────────────────────────────────
const CADD_PRESETS: Record<string, { dose: number; freq: number; conc: number; kvo: number }> = {
  'Ampicillin':               { dose: 6000,  freq: 4,  conc: 40,    kvo: 2 },
  'Cefazolin':                { dose: 6000,  freq: 8,  conc: 50,    kvo: 2 },
  'Cefepime':                 { dose: 6000,  freq: 8,  conc: 50,    kvo: 2 },
  'Ceftazidime':              { dose: 6000,  freq: 8,  conc: 50,    kvo: 2 },
  'Ceftriaxone':              { dose: 2000,  freq: 24, conc: 40,    kvo: 2 },
  'Daptomycin':               { dose: 500,   freq: 24, conc: 50,    kvo: 2 },
  'Ertapenem':                { dose: 1000,  freq: 24, conc: 20,    kvo: 2 },
  'Fluconazole':              { dose: 400,   freq: 24, conc: 2,     kvo: 2 },
  'Meropenem':                { dose: 3000,  freq: 8,  conc: 40,    kvo: 2 },
  'Nafcillin':                { dose: 6000,  freq: 4,  conc: 40,    kvo: 2 },
  'Ampicillin/Sulbactam':      { dose: 3000,  freq: 6,  conc: 45,    kvo: 2 },
  'Piperacillin/Tazobactam':  { dose: 13500, freq: 8,  conc: 67.5,  kvo: 2 },
  'Vancomycin':               { dose: 1500,  freq: 12, conc: 5,     kvo: 2 },
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

// ── Bayesian (MAP) priors ──
// Lognormal between-subject variability and proportional residual error.
// Values are typical literature ranges for 1-compartment vancomycin popPK.
const VANCO_OMEGA_CL = 0.30; // ~30% CV on clearance
const VANCO_OMEGA_V = 0.25;  // ~25% CV on volume
const VANCO_SIGMA = 0.15;    // 15% proportional assay/model residual error

type VancoLevel = { conc: number; time: number }; // time = h AFTER end of infusion

// Steady-state one-compartment concentration for an intermittent infusion.
// Cmax_ss = (R0/CL)·(1−e^−k·tInf)/(1−e^−k·τ); then decays over tAfterInfEnd.
function vancoSSConc(
  cl: number, v: number, dose: number, tau: number, tInf: number, tAfterInfEnd: number,
): number {
  const k = cl / v;
  const r0 = dose / tInf;
  const cmax = (r0 / cl) * ((1 - Math.exp(-k * tInf)) / (1 - Math.exp(-k * tau)));
  return cmax * Math.exp(-k * tAfterInfEnd);
}

// Maximum a posteriori (MAP) Bayesian estimate of individual CL and V given a
// population prior and 1+ measured levels. Minimises the standard objective:
//   OFV = Σ[(Cobs−Cpred)/(σ·Cpred)]² + (ηCL/ωCL)² + (ηV/ωV)²
// where η are lognormal deviations from the population means. Solved with a
// deterministic coarse-to-fine grid search (no convergence pitfalls in-browser).
// With a single level the data under-determine the 2 params, so the prior
// supplies what the level can't — exactly why single-trough AUC monitoring works.
function vancoMAP(opts: {
  clPop: number; vPop: number; dose: number; tau: number; tInf: number; levels: VancoLevel[];
}): { cl: number; v: number; k: number; halfLife: number } | null {
  const { clPop, vPop, dose, tau, tInf, levels } = opts;
  if (!(clPop > 0 && vPop > 0 && dose > 0 && tau > 0 && tInf > 0) || levels.length === 0) return null;

  const ofv = (etaCL: number, etaV: number): number => {
    const cl = clPop * Math.exp(etaCL);
    const v = vPop * Math.exp(etaV);
    let resid = 0;
    for (const lv of levels) {
      const cpred = vancoSSConc(cl, v, dose, tau, tInf, lv.time);
      if (cpred < 1e-6) return Number.POSITIVE_INFINITY;
      const w = (lv.conc - cpred) / (VANCO_SIGMA * cpred);
      resid += w * w;
    }
    return resid + (etaCL / VANCO_OMEGA_CL) ** 2 + (etaV / VANCO_OMEGA_V) ** 2;
  };

  let best = { a: 0, b: 0, f: ofv(0, 0) };
  // Coarse pass: ±1.2 (~±4 SD) on each η.
  for (let a = -1.2; a <= 1.2001; a += 0.06) {
    for (let b = -1.2; b <= 1.2001; b += 0.06) {
      const f = ofv(a, b);
      if (f < best.f) best = { a, b, f };
    }
  }
  // Fine pass around the coarse optimum.
  const a0 = best.a, b0 = best.b;
  for (let a = a0 - 0.06; a <= a0 + 0.0601; a += 0.004) {
    for (let b = b0 - 0.06; b <= b0 + 0.0601; b += 0.004) {
      const f = ofv(a, b);
      if (f < best.f) best = { a, b, f };
    }
  }
  const cl = clPop * Math.exp(best.a);
  const v = vPop * Math.exp(best.b);
  const k = cl / v;
  return { cl, v, k, halfLife: 0.693 / k };
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
    const roundedDose = Math.round(rawDose / 250) * 250;
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

    // Loading dose 25 mg/kg actual (cap 3000 mg), per guideline for serious infx.
    const loading = Math.min(3000, Math.round((25 * actualKg) / 250) * 250);

    const inRange = projAUC >= VANCO_AUC_LOW && projAUC <= VANCO_AUC_HIGH;

    return {
      crcl, ibw, dosingWt, basis, kel, vd, halfLife, cl,
      interval, roundedDose, actualDailyDose, projAUC, cmax, cmin, loading, inRange,
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

  // ── Bayesian (MAP) engine ──
  // Reuses the shared demographics (age/scr/sex/ht/wt) to build the population
  // prior, then fits CL & V to 1–2 measured levels. Supports a single trough,
  // which is the headline capability of commercial Bayesian dosing tools.
  const [bDose, setBDose] = useState('');
  const [bTau, setBTau] = useState('12');
  const [bInf, setBInf] = useState('1');
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

    // Build population prior from the same equations the Empiric tab uses.
    const ibw = vancoIBW(htIn, female);
    const cgWeight = actualKg < ibw ? actualKg : ibw;
    let crcl = ((140 - ageN) * cgWeight) / (72 * scrN);
    if (female) crcl *= 0.85;
    const { weight: dosingWt } = vancoDosingWeight(actualKg, ibw);
    const kPop = 0.00083 * crcl + 0.0044;
    const vPop = 0.7 * dosingWt;
    const clPop = kPop * vPop;

    // Assemble measured levels.
    const levels: VancoLevel[] = [];
    const c1 = parseFloat(bConc1), t1 = parseFloat(bTime1);
    if (c1 > 0 && t1 >= 0) levels.push({ conc: c1, time: t1 });
    if (bUseTwo) {
      const c2 = parseFloat(bConc2), t2 = parseFloat(bTime2);
      if (c2 > 0 && t2 >= 0) levels.push({ conc: c2, time: t2 });
    }
    if (levels.length === 0) return { kind: 'incomplete' } as const;

    const fit = vancoMAP({ clPop, vPop, dose, tau, tInf, levels });
    if (!fit) return { kind: 'incomplete' } as const;

    // AUC24 from the Bayesian-fit clearance: AUC_tau = dose/CL, scaled to 24 h.
    const auc24 = (dose / fit.cl) * (24 / tau);
    const cmax = vancoSSConc(fit.cl, fit.v, dose, tau, tInf, 0);
    const cmin = vancoSSConc(fit.cl, fit.v, dose, tau, tInf, tau - tInf);

    // Dose to hit AUC mid (500) at the same interval.
    const targetDaily = VANCO_AUC_MID * fit.cl;
    const newDose = Math.round(targetDaily / (24 / tau) / 250) * 250;
    const inRange = auc24 >= VANCO_AUC_LOW && auc24 <= VANCO_AUC_HIGH;

    // Shrinkage indicator: how far the fit moved from the prior (informativeness
    // of the data). Small move = prior-dominated (typical for a single level).
    const clShift = ((fit.cl - clPop) / clPop) * 100;

    return {
      kind: 'result' as const,
      clPop, vPop, crcl, fit, auc24, cmax, cmin, newDose, inRange, clShift,
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
                  <span className="font-semibold text-slate-200">{empiric.loading} mg</span> (25 mg/kg) for serious infection
                </div>
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
          {/* Bayesian (MAP) — population prior from demographics + 1-2 levels */}
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
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">MAP Estimates vs Population Prior</div>
                {[
                  ['Population CL (prior)', `${bayesian.clPop.toFixed(2)} L/h`],
                  ['Individual CL (MAP fit)', `${bayesian.fit.cl.toFixed(2)} L/h`],
                  ['Individual Vd (MAP fit)', `${bayesian.fit.v.toFixed(1)} L`],
                  ['Half-life (t½)', `${bayesian.fit.halfLife.toFixed(1)} h`],
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
        Decision-support estimate only. The Bayesian mode uses a 1-compartment population prior with
        literature-typical variability (CL ω≈30%, V ω≈25%, proportional residual 15%); it is not calibrated
        to any specific institutional model. Population PK assumes stable renal function; verify in critically
        ill, unstable-renal, or obese patients. Not a substitute for a validated Bayesian platform or clinical
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
          Calculates CADD bag volumes and doses for 1–5 day durations. Select a preset antibiotic or enter custom values.
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
        </div>

        {/* Dose & Freq */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Dose (mg)</label>
            <input type="number" value={dose} onChange={e => setDose(parseFloat(e.target.value) || 0)} className={tableInputCls} />
          </div>
          <div>
            <label className={labelCls}>Freq (q_hr)</label>
            <input type="number" value={freq} onChange={e => setFreq(parseFloat(e.target.value) || 0)} className={tableInputCls} />
          </div>
        </div>

        {/* Concentration */}
        <div>
          <label className={labelCls}>Concentration (mg/mL)</label>
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
                    const mg = getPracticalBagVol(d) * conc;
                    const display = mg >= 1000
                      ? `${(mg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} g`
                      : `${Math.round(mg)} mg`;
                    return (
                      <td key={d} className="px-4 py-3 text-center border-l border-white/5 align-top">
                        <span className="text-emerald-400 font-bold text-base block">{display}</span>
                        <span className="text-[10px] text-slate-500 block">{Math.round(mg).toLocaleString()} mg</span>
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
        {activeCalc === 'calcium'&& <CorrectedCalciumCalculator />}
      </div>
    </div>
  );
}
