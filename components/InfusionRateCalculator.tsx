'use client';

import { useState, useMemo } from 'react';
import { Calculator, Copy, Check, Info, ChevronDown, FlaskConical, Clock, ExternalLink } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Presets — biologic / titrated infusion regimens (mg/hr step-ups)
// Modeled on FDA package-insert titration schedules so nursing has a
// validated starting point and can override any parameter for custom orders.
// All rates expressed in mg/hr (the calculator converts to mL/hr using
// concentration). Fixed-rate schedules use stepIncrement=0 with start=max
// computed from PI duration: rate(mg/hr) = dose(mg) × 60 / duration(min).
// ─────────────────────────────────────────────────────────────────────────────
type PresetCategory = 'Step-up Titration' | 'Fixed Rate';

type Preset = {
  id: string;
  label: string;
  category: PresetCategory;
  startRate: number;          // mg/hr
  stepIncrement: number;      // mg/hr added per step (0 = no titration)
  intervalMin: number;        // minutes between rate increases
  maxRate: number;            // mg/hr cap
  defaultDose?: number;       // mg (typical adult dose)
  defaultVolume?: number;     // mL (typical bag volume)
  notes: string;
};

const PRESETS: Preset[] = [
  // ═══════════════ STEP-UP TITRATION (per FDA PI) ═══════════════
  {
    id: 'rituximab-1',
    label: 'Rituximab — 1st infusion',
    category: 'Step-up Titration',
    startRate: 50, stepIncrement: 50, intervalMin: 30, maxRate: 400,
    defaultDose: 700, defaultVolume: 700,
    notes: 'Start 50 mg/hr; ↑50 mg/hr every 30 min as tolerated to max 400 mg/hr (Rituxan PI).',
  },
  {
    id: 'rituximab-sub',
    label: 'Rituximab — subsequent infusion',
    category: 'Step-up Titration',
    startRate: 100, stepIncrement: 100, intervalMin: 30, maxRate: 400,
    defaultDose: 700, defaultVolume: 500,
    notes: 'After tolerated 1st infusion: start 100 mg/hr; ↑100 mg/hr every 30 min to max 400 mg/hr.',
  },
  {
    id: 'daratumumab-1',
    label: 'Daratumumab IV — 1st infusion',
    category: 'Step-up Titration',
    startRate: 50, stepIncrement: 50, intervalMin: 60, maxRate: 200,
    defaultDose: 1280, defaultVolume: 1000,
    notes: 'Start 50 mg/hr; ↑50 mg/hr every 1 hr to max 200 mg/hr (Darzalex IV PI).',
  },
  {
    id: 'daratumumab-2',
    label: 'Daratumumab IV — 2nd infusion',
    category: 'Step-up Titration',
    startRate: 50, stepIncrement: 50, intervalMin: 60, maxRate: 200,
    defaultDose: 1280, defaultVolume: 500,
    notes: '2nd infusion: only escalate after 1st tolerated without grade ≥1 reaction.',
  },
  {
    id: 'daratumumab-sub',
    label: 'Daratumumab IV — subsequent (3+)',
    category: 'Step-up Titration',
    startRate: 100, stepIncrement: 50, intervalMin: 60, maxRate: 200,
    defaultDose: 1280, defaultVolume: 500,
    notes: 'Subsequent: start 100 mg/hr; ↑50 mg/hr every 1 hr to max 200 mg/hr.',
  },
  {
    id: 'obinutuzumab-c1d1',
    label: 'Obinutuzumab — C1D1 (100 mg, fixed)',
    category: 'Step-up Titration',
    startRate: 25, stepIncrement: 0, intervalMin: 0, maxRate: 25,
    defaultDose: 100, defaultVolume: 250,
    notes: 'C1D1: 100 mg over 4 hr at 25 mg/hr. Do not titrate. (Gazyva PI)',
  },
  {
    id: 'obinutuzumab-c1d2',
    label: 'Obinutuzumab — C1D2 (900 mg)',
    category: 'Step-up Titration',
    startRate: 50, stepIncrement: 50, intervalMin: 30, maxRate: 400,
    defaultDose: 900, defaultVolume: 250,
    notes: 'C1D2: start 50 mg/hr; ↑50 mg/hr every 30 min to max 400 mg/hr.',
  },
  {
    id: 'isatuximab-1',
    label: 'Isatuximab — 1st infusion',
    category: 'Step-up Titration',
    startRate: 25, stepIncrement: 25, intervalMin: 30, maxRate: 150,
    defaultDose: 700, defaultVolume: 250,
    notes: 'First infusion ramp: 25 mg/hr × 60 min, ↑25 mg/hr q30min to 150 mg/hr; then ↑50 mg/hr q30min to max 400 mg/hr per Sarclisa PI. Verify with full schedule.',
  },
  {
    id: 'isatuximab-2',
    label: 'Isatuximab — 2nd infusion',
    category: 'Step-up Titration',
    startRate: 50, stepIncrement: 50, intervalMin: 30, maxRate: 400,
    defaultDose: 700, defaultVolume: 250,
    notes: '2nd infusion: 50 mg/hr × 30 min, then ↑50 mg/hr q30min to max 400 mg/hr.',
  },
  {
    id: 'isatuximab-sub',
    label: 'Isatuximab — subsequent (3+)',
    category: 'Step-up Titration',
    startRate: 200, stepIncrement: 200, intervalMin: 30, maxRate: 400,
    defaultDose: 700, defaultVolume: 250,
    notes: 'Subsequent (rapid): 200 mg/hr × 30 min, then 400 mg/hr until complete.',
  },
  {
    id: 'ocrelizumab-12',
    label: 'Ocrelizumab — 1st/2nd dose (300 mg)',
    category: 'Step-up Titration',
    startRate: 36, stepIncrement: 36, intervalMin: 30, maxRate: 216,
    defaultDose: 300, defaultVolume: 250,
    notes: 'Initial 300 mg dose × 2 (Day 1 + Day 15). 30 → 60 → 90 → 120 → 150 → 180 mL/hr q30min (Ocrevus PI).',
  },
  {
    id: 'ocrelizumab-sub',
    label: 'Ocrelizumab — subsequent (600 mg)',
    category: 'Step-up Titration',
    startRate: 48, stepIncrement: 48, intervalMin: 30, maxRate: 240,
    defaultDose: 600, defaultVolume: 500,
    notes: '600 mg q6mo: 40 → 80 → 120 → 160 → 200 mL/hr q30min (≥3.5 hr total).',
  },
  {
    id: 'inebilizumab',
    label: 'Inebilizumab (Uplizna)',
    category: 'Step-up Titration',
    startRate: 36, stepIncrement: 36, intervalMin: 30, maxRate: 144,
    defaultDose: 300, defaultVolume: 250,
    notes: '300 mg in 250 mL: 30 → 60 → 90 → 120 mL/hr q30min until complete (Uplizna PI).',
  },

  // ═══════════════ FIXED-RATE INFUSIONS (no titration) ═══════════════
  {
    id: 'trastuzumab-load',
    label: 'Trastuzumab — loading (90 min)',
    category: 'Fixed Rate',
    startRate: 373, stepIncrement: 0, intervalMin: 0, maxRate: 373,
    defaultDose: 560, defaultVolume: 250,
    notes: 'Loading 8 mg/kg over 90 min (Herceptin PI). Adjust dose to actual weight.',
  },
  {
    id: 'trastuzumab-maint',
    label: 'Trastuzumab — maintenance (30 min)',
    category: 'Fixed Rate',
    startRate: 840, stepIncrement: 0, intervalMin: 0, maxRate: 840,
    defaultDose: 420, defaultVolume: 250,
    notes: 'Maintenance 6 mg/kg over 30 min if loading tolerated.',
  },
  {
    id: 'pertuzumab-load',
    label: 'Pertuzumab — loading (60 min)',
    category: 'Fixed Rate',
    startRate: 840, stepIncrement: 0, intervalMin: 0, maxRate: 840,
    defaultDose: 840, defaultVolume: 250,
    notes: '840 mg loading dose over 60 min (Perjeta PI).',
  },
  {
    id: 'pertuzumab-maint',
    label: 'Pertuzumab — maintenance (30 min)',
    category: 'Fixed Rate',
    startRate: 840, stepIncrement: 0, intervalMin: 0, maxRate: 840,
    defaultDose: 420, defaultVolume: 250,
    notes: '420 mg q3w over 30–60 min if loading tolerated.',
  },
  {
    id: 'bevacizumab-1',
    label: 'Bevacizumab — 1st (90 min)',
    category: 'Fixed Rate',
    startRate: 350, stepIncrement: 0, intervalMin: 0, maxRate: 350,
    defaultDose: 525, defaultVolume: 100,
    notes: '5–15 mg/kg over 90 min for first infusion (Avastin PI).',
  },
  {
    id: 'bevacizumab-2',
    label: 'Bevacizumab — 2nd (60 min)',
    category: 'Fixed Rate',
    startRate: 525, stepIncrement: 0, intervalMin: 0, maxRate: 525,
    defaultDose: 525, defaultVolume: 100,
    notes: '2nd infusion over 60 min if 1st tolerated.',
  },
  {
    id: 'bevacizumab-sub',
    label: 'Bevacizumab — subsequent (30 min)',
    category: 'Fixed Rate',
    startRate: 1050, stepIncrement: 0, intervalMin: 0, maxRate: 1050,
    defaultDose: 525, defaultVolume: 100,
    notes: 'Subsequent: 30 min if 2nd tolerated.',
  },
  {
    id: 'cetuximab-load',
    label: 'Cetuximab — loading (120 min)',
    category: 'Fixed Rate',
    startRate: 400, stepIncrement: 0, intervalMin: 0, maxRate: 400,
    defaultDose: 800, defaultVolume: 500,
    notes: 'Loading 400 mg/m² over 120 min; max 10 mg/min (600 mg/hr) (Erbitux PI).',
  },
  {
    id: 'cetuximab-sub',
    label: 'Cetuximab — subsequent (60 min)',
    category: 'Fixed Rate',
    startRate: 425, stepIncrement: 0, intervalMin: 0, maxRate: 425,
    defaultDose: 425, defaultVolume: 250,
    notes: '250 mg/m² weekly over 60 min; max 10 mg/min.',
  },
  {
    id: 'pembrolizumab-q3w',
    label: 'Pembrolizumab — 200 mg q3w (30 min)',
    category: 'Fixed Rate',
    startRate: 400, stepIncrement: 0, intervalMin: 0, maxRate: 400,
    defaultDose: 200, defaultVolume: 100,
    notes: '200 mg IV q3w over 30 min (Keytruda PI).',
  },
  {
    id: 'pembrolizumab-q6w',
    label: 'Pembrolizumab — 400 mg q6w (30 min)',
    category: 'Fixed Rate',
    startRate: 800, stepIncrement: 0, intervalMin: 0, maxRate: 800,
    defaultDose: 400, defaultVolume: 100,
    notes: '400 mg q6w alternative dosing over 30 min.',
  },
  {
    id: 'nivolumab-q2w',
    label: 'Nivolumab — 240 mg q2w (30 min)',
    category: 'Fixed Rate',
    startRate: 480, stepIncrement: 0, intervalMin: 0, maxRate: 480,
    defaultDose: 240, defaultVolume: 100,
    notes: '240 mg q2w over 30 min (Opdivo PI).',
  },
  {
    id: 'nivolumab-q4w',
    label: 'Nivolumab — 480 mg q4w (30 min)',
    category: 'Fixed Rate',
    startRate: 960, stepIncrement: 0, intervalMin: 0, maxRate: 960,
    defaultDose: 480, defaultVolume: 100,
    notes: '480 mg q4w alternative dosing over 30 min.',
  },
  {
    id: 'atezolizumab-1',
    label: 'Atezolizumab — 1st (60 min)',
    category: 'Fixed Rate',
    startRate: 1200, stepIncrement: 0, intervalMin: 0, maxRate: 1200,
    defaultDose: 1200, defaultVolume: 250,
    notes: '1st infusion 1200 mg over 60 min (Tecentriq PI).',
  },
  {
    id: 'atezolizumab-sub',
    label: 'Atezolizumab — subsequent (30 min)',
    category: 'Fixed Rate',
    startRate: 2400, stepIncrement: 0, intervalMin: 0, maxRate: 2400,
    defaultDose: 1200, defaultVolume: 250,
    notes: 'Subsequent 30 min if 1st tolerated.',
  },
  {
    id: 'durvalumab',
    label: 'Durvalumab — 10 mg/kg q2w (60 min)',
    category: 'Fixed Rate',
    startRate: 700, stepIncrement: 0, intervalMin: 0, maxRate: 700,
    defaultDose: 700, defaultVolume: 100,
    notes: '10 mg/kg q2w over 60 min (Imfinzi PI). Fixed 1500 mg q4w for ≥30 kg.',
  },
  {
    id: 'avelumab',
    label: 'Avelumab — 800 mg q2w (60 min)',
    category: 'Fixed Rate',
    startRate: 800, stepIncrement: 0, intervalMin: 0, maxRate: 800,
    defaultDose: 800, defaultVolume: 250,
    notes: '800 mg q2w over 60 min (Bavencio PI). Premedicate with H1+APAP for first 4 doses.',
  },
  {
    id: 'sacituzumab-1',
    label: 'Sacituzumab Govitecan — 1st (180 min)',
    category: 'Fixed Rate',
    startRate: 233, stepIncrement: 0, intervalMin: 0, maxRate: 233,
    defaultDose: 700, defaultVolume: 250,
    notes: '10 mg/kg over 3 hr (Trodelvy PI).',
  },
  {
    id: 'sacituzumab-sub',
    label: 'Sacituzumab Govitecan — subsequent (60 min)',
    category: 'Fixed Rate',
    startRate: 700, stepIncrement: 0, intervalMin: 0, maxRate: 700,
    defaultDose: 700, defaultVolume: 250,
    notes: 'Subsequent 60 min if 1st tolerated.',
  },
  {
    id: 'brentuximab',
    label: 'Brentuximab Vedotin (30 min)',
    category: 'Fixed Rate',
    startRate: 252, stepIncrement: 0, intervalMin: 0, maxRate: 252,
    defaultDose: 126, defaultVolume: 150,
    notes: '1.8 mg/kg q3w over 30 min (Adcetris PI). Max 180 mg per dose.',
  },
  {
    id: 'polatuzumab-1',
    label: 'Polatuzumab Vedotin — 1st (90 min)',
    category: 'Fixed Rate',
    startRate: 84, stepIncrement: 0, intervalMin: 0, maxRate: 84,
    defaultDose: 126, defaultVolume: 100,
    notes: '1.8 mg/kg q3w over 90 min initial (Polivy PI).',
  },
  {
    id: 'polatuzumab-sub',
    label: 'Polatuzumab Vedotin — subsequent (30 min)',
    category: 'Fixed Rate',
    startRate: 252, stepIncrement: 0, intervalMin: 0, maxRate: 252,
    defaultDose: 126, defaultVolume: 100,
    notes: 'Subsequent 30 min if 1st tolerated.',
  },
  {
    id: 'enfortumab',
    label: 'Enfortumab Vedotin (30 min)',
    category: 'Fixed Rate',
    startRate: 175, stepIncrement: 0, intervalMin: 0, maxRate: 175,
    defaultDose: 87.5, defaultVolume: 50,
    notes: '1.25 mg/kg D1, D8, D15 of 28-day cycle over 30 min (Padcev PI).',
  },
  {
    id: 'tdm1',
    label: 'Ado-trastuzumab Emtansine — 1st (90 min)',
    category: 'Fixed Rate',
    startRate: 173, stepIncrement: 0, intervalMin: 0, maxRate: 173,
    defaultDose: 260, defaultVolume: 250,
    notes: '3.6 mg/kg q3w over 90 min for 1st infusion (Kadcyla PI).',
  },
  {
    id: 'tdm1-sub',
    label: 'Ado-trastuzumab Emtansine — subsequent (30 min)',
    category: 'Fixed Rate',
    startRate: 520, stepIncrement: 0, intervalMin: 0, maxRate: 520,
    defaultDose: 260, defaultVolume: 250,
    notes: 'Subsequent over 30 min if 1st tolerated.',
  },
  {
    id: 'vedolizumab',
    label: 'Vedolizumab — 300 mg (30 min)',
    category: 'Fixed Rate',
    startRate: 600, stepIncrement: 0, intervalMin: 0, maxRate: 600,
    defaultDose: 300, defaultVolume: 250,
    notes: '300 mg over 30 min (Entyvio PI).',
  },
  {
    id: 'natalizumab',
    label: 'Natalizumab — 300 mg (60 min)',
    category: 'Fixed Rate',
    startRate: 300, stepIncrement: 0, intervalMin: 0, maxRate: 300,
    defaultDose: 300, defaultVolume: 100,
    notes: '300 mg q4w over 60 min, observe ≥1 hr (Tysabri TOUCH REMS).',
  },
  {
    id: 'belimumab',
    label: 'Belimumab — 10 mg/kg (60 min)',
    category: 'Fixed Rate',
    startRate: 700, stepIncrement: 0, intervalMin: 0, maxRate: 700,
    defaultDose: 700, defaultVolume: 250,
    notes: '10 mg/kg q4w over 60 min (Benlysta PI).',
  },
  {
    id: 'eculizumab',
    label: 'Eculizumab — 900 mg (35 min)',
    category: 'Fixed Rate',
    startRate: 1543, stepIncrement: 0, intervalMin: 0, maxRate: 1543,
    defaultDose: 900, defaultVolume: 180,
    notes: 'PNH/aHUS: 900 mg q2w over 35 min (Soliris PI).',
  },
  {
    id: 'ravulizumab',
    label: 'Ravulizumab — wt-based (~45 min)',
    category: 'Fixed Rate',
    startRate: 4400, stepIncrement: 0, intervalMin: 0, maxRate: 4400,
    defaultDose: 3300, defaultVolume: 240,
    notes: 'Weight-based; approx 45 min for 60–100 kg patient (Ultomiris PI). Verify duration table.',
  },
  {
    id: 'tocilizumab',
    label: 'Tocilizumab — 8 mg/kg (60 min)',
    category: 'Fixed Rate',
    startRate: 560, stepIncrement: 0, intervalMin: 0, maxRate: 560,
    defaultDose: 560, defaultVolume: 100,
    notes: 'RA: 4–8 mg/kg q4w over 60 min (Actemra PI). Same rate for CRS.',
  },
  {
    id: 'infliximab',
    label: 'Infliximab — 5 mg/kg (≥120 min)',
    category: 'Fixed Rate',
    startRate: 175, stepIncrement: 0, intervalMin: 0, maxRate: 175,
    defaultDose: 350, defaultVolume: 250,
    notes: 'Standard 5 mg/kg over ≥2 hr (Remicade PI). Use Step ↑ for IRR-history titration.',
  },
];

// Build category groupings for the <select> dropdown
const PRESET_CATEGORIES: PresetCategory[] = ['Step-up Titration', 'Fixed Rate'];
const PRESETS_BY_CATEGORY = PRESET_CATEGORIES.map(cat => ({
  category: cat,
  items: PRESETS.filter(p => p.category === cat),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
type StepRow = {
  step: number;
  windowLabel: string;
  rateMgHr: number;
  rateMlHr: number;
  vtbiMl: number;
  durationMin: number;
  cumulativeVolume: number;
  cumulativeDose: number;
  isFinal: boolean;
  isMaxRate: boolean;
};

const MAX_STEPS = 60; // safety guard against infinite loops

export function InfusionRateCalculator() {
  // ── User inputs ────────────────────────────────────────────────────────────
  const [presetId, setPresetId] = useState<string>('rituximab-1');
  const [drugName, setDrugName] = useState('Rituximab');
  const [doseMg, setDoseMg] = useState<number | ''>(700);
  const [volumeMl, setVolumeMl] = useState<number | ''>(700);
  const [startRate, setStartRate] = useState<number | ''>(50);
  const [stepIncrement, setStepIncrement] = useState<number | ''>(50);
  const [intervalMin, setIntervalMin] = useState<number | ''>(30);
  const [maxRate, setMaxRate] = useState<number | ''>(400);
  const [copied, setCopied] = useState(false);

  // ── Apply preset ───────────────────────────────────────────────────────────
  const handlePresetChange = (id: string) => {
    setPresetId(id);
    if (id === 'custom') return;
    const p = PRESETS.find(x => x.id === id);
    if (!p) return;
    setDrugName(p.label.split(' — ')[0]);
    setStartRate(p.startRate);
    setStepIncrement(p.stepIncrement);
    setIntervalMin(p.intervalMin);
    setMaxRate(p.maxRate);
    if (p.defaultDose) setDoseMg(p.defaultDose);
    if (p.defaultVolume) setVolumeMl(p.defaultVolume);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const concentration = useMemo<number | null>(() => {
    if (typeof doseMg !== 'number' || typeof volumeMl !== 'number') return null;
    if (doseMg <= 0 || volumeMl <= 0) return null;
    return doseMg / volumeMl;
  }, [doseMg, volumeMl]);

  const isValid = useMemo(() => {
    return (
      typeof doseMg === 'number' && doseMg > 0 &&
      typeof volumeMl === 'number' && volumeMl > 0 &&
      typeof startRate === 'number' && startRate > 0 &&
      typeof maxRate === 'number' && maxRate >= startRate &&
      typeof intervalMin === 'number' && intervalMin >= 0 &&
      typeof stepIncrement === 'number' && stepIncrement >= 0
    );
  }, [doseMg, volumeMl, startRate, maxRate, intervalMin, stepIncrement]);

  // ── Build titration schedule ───────────────────────────────────────────────
  const schedule = useMemo<StepRow[] | null>(() => {
    if (!isValid || !concentration) return null;

    const steps: StepRow[] = [];
    let remainingVol = volumeMl as number;
    let cumulativeTime = 0;
    let stepIndex = 1;

    while (remainingVol > 0.01 && stepIndex <= MAX_STEPS) {
      // current rate for this step (mg/hr)
      const rawRate = (startRate as number) + (stepIndex - 1) * (stepIncrement as number);
      const rateMgHr = Math.min(rawRate, maxRate as number);
      const isMaxRate = rateMgHr >= (maxRate as number);
      const rateMlHr = rateMgHr / concentration;

      // step duration: the titration interval — except once we reach max rate,
      // we just run until the bag is empty.
      const stepDuration = isMaxRate || (stepIncrement as number) === 0
        ? (remainingVol / rateMlHr) * 60
        : (intervalMin as number);

      // volume infused during this step
      const maxVolThisStep = (rateMlHr * stepDuration) / 60;
      let vtbi = maxVolThisStep;
      let actualDuration = stepDuration;
      let isFinal = false;

      if (vtbi >= remainingVol - 0.01) {
        vtbi = remainingVol;
        actualDuration = (remainingVol / rateMlHr) * 60;
        isFinal = true;
      }

      const startMin = Math.round(cumulativeTime);
      const endMin = Math.round(cumulativeTime + actualDuration);
      const windowLabel = isFinal && isMaxRate
        ? `${startMin} – ${endMin} min (to completion)`
        : `${startMin} – ${endMin} min`;

      remainingVol -= vtbi;
      cumulativeTime += actualDuration;

      steps.push({
        step: stepIndex,
        windowLabel,
        rateMgHr,
        rateMlHr,
        vtbiMl: vtbi,
        durationMin: actualDuration,
        cumulativeVolume: (volumeMl as number) - remainingVol,
        cumulativeDose: ((volumeMl as number) - remainingVol) * concentration,
        isFinal,
        isMaxRate,
      });

      if (isFinal) break;
      stepIndex++;
    }

    return steps;
  }, [isValid, concentration, volumeMl, startRate, maxRate, stepIncrement, intervalMin]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!schedule || schedule.length === 0) return null;
    const totalMin = schedule.reduce((s, r) => s + r.durationMin, 0);
    const finalRate = schedule[schedule.length - 1].rateMlHr;
    const titrationMin = schedule
      .filter(s => !s.isMaxRate)
      .reduce((s, r) => s + r.durationMin, 0);
    return {
      totalMin,
      titrationMin,
      timeToMax: schedule.find(s => s.isMaxRate)
        ? schedule.findIndex(s => s.isMaxRate) * (intervalMin as number)
        : null,
      finalRateMlHr: finalRate,
      stepCount: schedule.length,
    };
  }, [schedule, intervalMin]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    let t = 0;
    const data: { time: number; rate: number; mgHr: number }[] = [];
    data.push({ time: 0, rate: schedule[0].rateMlHr, mgHr: schedule[0].rateMgHr });
    for (const step of schedule) {
      t += step.durationMin;
      data.push({ time: Math.round(t), rate: step.rateMlHr, mgHr: step.rateMgHr });
    }
    return data;
  }, [schedule]);

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  const copyToClipboard = async () => {
    if (!schedule || !concentration || !summary) return;
    const fmt = (n: number, d = 1) => n.toFixed(d);

    let plain = `INFUSION RATE PROTOCOL — ${drugName || 'Custom'}\n`;
    plain += `Total Dose: ${doseMg} mg in ${volumeMl} mL (${fmt(concentration, 2)} mg/mL)\n`;
    plain += `Titration: start ${startRate} mg/hr → ↑${stepIncrement} mg/hr q${intervalMin} min → max ${maxRate} mg/hr\n`;
    plain += `Estimated total time: ${Math.floor(summary.totalMin / 60)}h ${Math.round(summary.totalMin) % 60}m\n\n`;
    plain += `Step | Time Window      | Pump Rate   | mg/hr   | VTBI       | Cum. Vol\n`;
    plain += '-'.repeat(80) + '\n';

    let html = `<div style="font-family: sans-serif;">
      <strong>INFUSION RATE PROTOCOL — ${drugName || 'Custom'}</strong><br/>
      <strong>Total Dose:</strong> ${doseMg} mg in ${volumeMl} mL (${fmt(concentration, 2)} mg/mL)<br/>
      <strong>Titration:</strong> start ${startRate} mg/hr → ↑${stepIncrement} mg/hr q${intervalMin} min → max ${maxRate} mg/hr<br/>
      <strong>Estimated total time:</strong> ${Math.floor(summary.totalMin / 60)}h ${Math.round(summary.totalMin) % 60}m<br/><br/>
      <table border="1" cellpadding="6" style="border-collapse: collapse; text-align: left; font-size: 13px;">
      <thead><tr style="background:#f3f4f6;">
        <th>Step</th><th>Time Window</th><th>Pump Rate (mL/hr)</th><th>Drug Rate (mg/hr)</th><th>VTBI (mL)</th><th>Cum. Volume (mL)</th>
      </tr></thead><tbody>`;

    schedule.forEach(s => {
      plain += `${String(s.step).padEnd(4)} | ${s.windowLabel.padEnd(17)} | ${fmt(s.rateMlHr).padEnd(11)} | ${String(s.rateMgHr).padEnd(7)} | ${fmt(s.vtbiMl).padEnd(10)} | ${fmt(s.cumulativeVolume)}\n`;
      html += `<tr><td>${s.step}${s.isFinal ? ' (final)' : ''}</td><td>${s.windowLabel}</td><td><strong>${fmt(s.rateMlHr)}</strong> mL/hr</td><td>${s.rateMgHr} mg/hr</td><td>${fmt(s.vtbiMl)} mL</td><td>${fmt(s.cumulativeVolume)} mL</td></tr>`;
    });

    html += '</tbody></table></div>';

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(plain);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-white tracking-tight">Infusion Rate Calculator</h3>
            <span className="bg-violet-500/10 text-violet-300 border border-violet-500/20 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase">
              Biologic Titration
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            Builds a step-up titration schedule (mg/hr → mL/hr) for nursing pump programming. Models rituximab/daratumumab-style protocols.
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          disabled={!schedule}
          className="bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied for EMR!' : 'Copy Schedule'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* ── Left – Inputs ───────────────────────────────────────────────── */}
        <div className="md:col-span-4 space-y-4">
          {/* Preset selector */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Drug Preset
            </label>
            <div className="relative">
              <select
                value={presetId}
                onChange={e => handlePresetChange(e.target.value)}
                className="appearance-none w-full px-4 py-3 pr-10 border border-white/5 rounded-xl focus:ring-2 focus:ring-violet-500/60 focus:border-violet-500/60 outline-none bg-[#161616] hover:bg-[#1e1e1e] text-[13px] font-medium text-white transition-all cursor-pointer"
              >
                <option className="bg-[#121212]" value="custom">Custom / Manual entry</option>
                {PRESETS_BY_CATEGORY.map(group => (
                  <optgroup key={group.category} label={group.category} className="bg-[#0a0a0a]">
                    {group.items.map(p => (
                      <option className="bg-[#121212]" key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            {presetId !== 'custom' && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[11px] text-slate-500 italic leading-relaxed">
                  {PRESETS.find(p => p.id === presetId)?.notes}
                </p>
              </div>
            )}
            <div className="mt-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Drug name (label only)
              </label>
              <input
                type="text"
                value={drugName}
                onChange={e => setDrugName(e.target.value)}
                placeholder="e.g. Rituximab"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          </div>

          {/* Bag composition */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Bag Composition
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Total Dose
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={doseMg}
                    onChange={e => setDoseMg(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-base font-medium text-white pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase">mg</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Bag Volume
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={volumeMl}
                    onChange={e => setVolumeMl(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-base font-medium text-white pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase">mL</span>
                </div>
              </div>
            </div>
            {concentration !== null && (
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Final Conc.</span>
                <span className="text-violet-300 font-mono text-sm font-medium">
                  {concentration.toFixed(2)} <span className="text-[10px] text-slate-500">mg/mL</span>
                </span>
              </div>
            )}
          </div>

          {/* Titration parameters */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Titration Parameters
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Start Rate
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={startRate}
                    onChange={e => setStartRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-base font-medium text-white pr-14 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase">mg/hr</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Max Rate
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={maxRate}
                    onChange={e => setMaxRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-base font-medium text-white pr-14 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase">mg/hr</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Step ↑ by
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={stepIncrement}
                    onChange={e => setStepIncrement(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-base font-medium text-white pr-14 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase">mg/hr</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Interval
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={intervalMin}
                    onChange={e => setIntervalMin(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-base font-medium text-white pr-12 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold uppercase">min</span>
                </div>
              </div>
            </div>
            <p className="mt-3 pt-3 border-t border-white/5 text-[10px] text-slate-500 italic leading-relaxed">
              Set <span className="text-slate-400 font-semibold">Step</span> = 0 for a fixed-rate (no titration) infusion.
            </p>
          </div>

          {/* Summary card */}
          {summary && schedule && (
            <div className="bg-violet-500/10 rounded-2xl p-5 border border-violet-500/20 shadow-inner">
              <h4 className="text-violet-300 text-xs font-semibold mb-3 uppercase tracking-wider">
                Administration Summary
              </h4>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Steps in schedule</span>
                  <span className="text-white font-medium text-sm">{summary.stepCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Titration duration</span>
                  <span className="text-white font-medium text-sm">
                    {Math.round(summary.titrationMin)} min
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Final pump rate</span>
                  <span className="text-white font-medium text-sm">
                    {summary.finalRateMlHr.toFixed(1)} mL/hr
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-violet-500/20">
                  <span className="text-violet-200 text-xs font-medium">Est. Completion</span>
                  <span className="text-white font-bold text-sm">
                    {Math.floor(Math.round(summary.totalMin) / 60)}h{' '}
                    {Math.round(summary.totalMin) % 60}m
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right – Schedule + Chart ─────────────────────────────────────── */}
        <div className="md:col-span-8 flex flex-col gap-6">
          {/* Schedule table */}
          <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider hidden sm:table-header-group">
                <tr>
                  <th className="px-5 py-3">Step / Time Window</th>
                  <th className="px-5 py-3 text-left">Pump Rate</th>
                  <th className="px-5 py-3 text-center">VTBI</th>
                  <th className="px-5 py-3 text-right">Cum. Vol.</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {!schedule ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <Calculator className="w-10 h-10 text-slate-600/50 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium text-sm">Ready to calculate</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Enter dose, bag volume, and titration parameters
                      </p>
                    </td>
                  </tr>
                ) : (
                  schedule.map((s, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                        s.isFinal ? 'bg-violet-500/5' : ''
                      } block sm:table-row`}
                    >
                      <td className="px-5 py-3 sm:py-4 block sm:table-cell border-b sm:border-0 border-white/5 sm:w-1/3">
                        <div className={`font-bold mb-0.5 text-sm ${s.isFinal ? 'text-violet-300' : 'text-slate-200'}`}>
                          Step {s.step}
                          {s.isMaxRate && (
                            <span className="ml-2 text-[9px] uppercase tracking-wider bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-bold">
                              Max
                            </span>
                          )}
                          {s.isFinal && !s.isMaxRate && (
                            <span className="ml-2 text-[9px] uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                              Final
                            </span>
                          )}
                        </div>
                        <div className={`text-xs font-medium leading-snug mb-1 ${s.isFinal ? 'text-violet-300/90' : 'text-slate-300'}`}>
                          {s.rateMgHr} mg/hr drug rate
                        </div>
                        <div className={`text-[10px] uppercase tracking-wider font-semibold ${s.isFinal ? 'text-violet-400/70' : 'text-slate-400'}`}>
                          {s.windowLabel}
                        </div>
                      </td>
                      <td className="px-5 py-2 sm:py-4 text-left block sm:table-cell bg-white/5 sm:bg-transparent">
                        <div className="sm:hidden text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                          Pump Rate
                        </div>
                        <div className="font-mono text-lg">
                          <span className={s.isFinal ? 'text-violet-300' : 'text-white'}>
                            {s.rateMlHr.toFixed(1)}
                          </span>
                          <span className="text-[10px] opacity-50 ml-1">mL/hr</span>
                        </div>
                      </td>
                      <td className="px-5 py-2 sm:py-4 text-left sm:text-center block sm:table-cell bg-white/5 sm:bg-transparent">
                        <div className="sm:hidden text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                          VTBI
                        </div>
                        <span className="font-mono text-base text-emerald-400">
                          {s.vtbiMl.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-emerald-400/60 ml-1">mL</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {Math.round(s.durationMin)} min
                        </div>
                      </td>
                      <td className="px-5 py-3 sm:py-4 text-left sm:text-right text-xs font-mono opacity-80 block sm:table-cell bg-white/5 sm:bg-transparent">
                        <div className="sm:hidden text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">
                          Cum. Vol.
                        </div>
                        {s.cumulativeVolume.toFixed(1)} mL
                        <div className="text-[10px] text-slate-500">
                          ({Math.round(s.cumulativeDose)} mg)
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Chart */}
          {schedule && schedule.length > 0 && (
            <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
              <h4 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-4">
                Titration Curve <span className="text-slate-500 font-normal normal-case">(mL/hr over time)</span>
              </h4>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="biolRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      stroke="rgba(255,255,255,0.2)"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                      tickFormatter={val => `${val}m`}
                      type="number"
                      domain={[0, 'dataMax']}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.2)"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as { mgHr?: number };
                          return (
                            <div className="bg-[#0f0f10] border border-white/10 rounded-xl p-3 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.5)] backdrop-blur-xl min-w-[170px]">
                              <div className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                                Time: {label}m
                              </div>
                              <div className="flex items-baseline gap-1.5 mb-1">
                                <span className="text-violet-400 font-bold text-2xl leading-none">
                                  {(payload[0].value as number).toFixed(1)}
                                </span>
                                <span className="text-violet-400/60 text-xs font-semibold">mL/hr</span>
                              </div>
                              {d.mgHr !== undefined && (
                                <p className="text-slate-500 text-[10px] font-medium">
                                  {d.mgHr} mg/hr drug rate
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="stepAfter"
                      dataKey="rate"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#biolRate)"
                      activeDot={{ r: 5, fill: '#a78bfa', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200/70 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 text-amber-500/70 mt-0.5" />
            <div>
              Disclaimer: This tool generates a titration schedule based on user-entered parameters and selected presets.
              Always verify against the current FDA package insert and institutional policy. Rate increases should only
              proceed if the patient is tolerating the current rate without infusion-related reactions.
            </div>
          </div>

          {/* Reference links */}
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
            <a
              href="https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=rituximab&searchtype=all"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Rituximab PI (DailyMed)</span>
            </a>
            <span className="hidden sm:inline text-slate-600">•</span>
            <a
              href="https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=darzalex&searchtype=all"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Daratumumab PI (DailyMed)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
