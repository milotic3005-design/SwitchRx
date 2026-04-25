'use client';

import { useState } from 'react';
import { Calculator, SlidersHorizontal, ListChecks, ChevronDown } from 'lucide-react';
import { IVIGRateCalculator } from './IVIGRateCalculator';

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
  { id: 'cadd',    label: 'CADD Bag Calculator' },
  { id: 'ivig',   label: 'IVIG Infusion Rate' },
  { id: 'crcl',   label: 'CrCl (Cockcroft-Gault)' },
  { id: 'adjbw',  label: 'Adjusted Body Weight' },
  { id: 'iron',   label: 'Iron Deficit (Ganzoni)' },
  { id: 'calcium',label: 'Corrected Calcium' },
  { id: 'bmi',    label: 'BMI Calculator' },
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

// ── Adjusted Body Weight ───────────────────────────────────────────────────────
function AdjBWCalculator() {
  const [ht, setHt] = useState('');
  const [wt, setWt] = useState('');
  const [female, setFemale] = useState(false);
  const [htUnit, setHtUnit] = useState('cm');
  const [wtUnit, setWtUnit] = useState('kg');

  const result = (() => {
    const htIn = htUnit === 'cm' ? parseFloat(ht) / 2.54 : parseFloat(ht);
    const wtKg = wtUnit === 'lb' ? parseFloat(wt) / 2.20462 : parseFloat(wt);
    if (htIn > 0 && wtKg > 0) {
      const over5ft = htIn - 60;
      const base = female ? 45.5 : 50;
      let ibw = base + Math.max(0, 2.3 * over5ft);
      if (over5ft < 0) ibw = base;
      if (wtKg <= ibw) return `${wtKg.toFixed(1)} (actual ≤ IBW)`;
      const adj = (ibw + 0.4 * (wtKg - ibw)).toFixed(1);
      return adj;
    }
    return null;
  })();

  const ibwOnly = (() => {
    const htIn = htUnit === 'cm' ? parseFloat(ht) / 2.54 : parseFloat(ht);
    if (htIn > 0) {
      const over5ft = htIn - 60;
      const base = female ? 45.5 : 50;
      return (base + Math.max(0, 2.3 * over5ft)).toFixed(1);
    }
    return null;
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-sm">
      <p className="text-xs text-slate-500 leading-relaxed">
        Calculates Ideal Body Weight (Devine formula) and Adjusted Body Weight for obese patients.
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
      {ibwOnly && (
        <div className="flex justify-between text-sm px-1">
          <span className="text-slate-500">IBW</span>
          <span className="text-slate-300 font-semibold">{ibwOnly} kg</span>
        </div>
      )}
      <ResultBadge label="Adjusted BW" value={result} unit="kg" color="emerald" />
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

// ── BMI Calculator ─────────────────────────────────────────────────────────────
function BMICalculator() {
  const [ht, setHt] = useState('');
  const [wt, setWt] = useState('');
  const [htUnit, setHtUnit] = useState('cm');
  const [wtUnit, setWtUnit] = useState('kg');

  const { bmi, category } = (() => {
    const htM = htUnit === 'cm' ? parseFloat(ht) / 100 : parseFloat(ht) * 0.0254;
    const wtKg = wtUnit === 'lb' ? parseFloat(wt) / 2.20462 : parseFloat(wt);
    if (htM > 0 && wtKg > 0) {
      const b = wtKg / (htM * htM);
      let cat = '';
      if (b < 18.5) cat = 'Underweight';
      else if (b < 25) cat = 'Normal weight';
      else if (b < 30) cat = 'Overweight';
      else if (b < 35) cat = 'Obese Class I';
      else if (b < 40) cat = 'Obese Class II';
      else cat = 'Obese Class III (Morbid)';
      return { bmi: b.toFixed(1), category: cat };
    }
    return { bmi: null, category: null };
  })();

  const bmiColor = (() => {
    if (!bmi) return 'blue';
    const v = parseFloat(bmi);
    if (v < 18.5) return 'blue';
    if (v < 25) return 'emerald';
    if (v < 30) return 'amber';
    return 'rose';
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-sm">
      <p className="text-xs text-slate-500 leading-relaxed">
        Body Mass Index — weight (kg) ÷ height² (m²).
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
          <label className={labelCls}>Weight</label>
          <div className="relative">
            <input type="number" value={wt} onChange={e => setWt(e.target.value)} placeholder={wtUnit === 'kg' ? '75' : '165'} className={`${inputCls} pr-12`} />
            <UnitToggle unit={wtUnit} onClick={() => setWtUnit(u => u === 'kg' ? 'lb' : 'kg')} />
          </div>
        </div>
      </div>
      <ResultBadge label="BMI" value={bmi} unit="kg/m²" color={bmiColor} />
      {category && bmi && (
        <p className="text-xs text-slate-400 px-1 font-medium">{category}</p>
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

        {activeCalc === 'cadd'    && <CADDCalculator />}
        {activeCalc === 'ivig'   && <IVIGRateCalculator />}
        {activeCalc === 'crcl'   && <CrClCalculator />}
        {activeCalc === 'adjbw'  && <AdjBWCalculator />}
        {activeCalc === 'iron'   && <IronDeficitCalculator />}
        {activeCalc === 'calcium'&& <CorrectedCalciumCalculator />}
        {activeCalc === 'bmi'    && <BMICalculator />}
      </div>
    </div>
  );
}
