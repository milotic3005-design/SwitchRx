'use client';

import { useState, useMemo } from 'react';
import { Calculator, Copy, Check, Info, ExternalLink, FileText } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ConditionType = 'PI' | 'MMN' | 'CIDP';

type ProtocolStep = {
  step: number;
  durationMins: number | null;
  rateMultiplier: number;
  label: string;
};

const Protocols: Record<
  ConditionType,
  { name: string; maxRate: number; steps: ProtocolStep[]; dosingInfo: string }
> = {
  PI: {
    name: 'Primary Immunodeficiency (PI)',
    maxRate: 5.0,
    steps: [
      { step: 1, durationMins: 30,   rateMultiplier: 0.5, label: '0 - 30 min' },
      { step: 2, durationMins: 30,   rateMultiplier: 1.0, label: '30 - 60 min' },
      { step: 3, durationMins: 30,   rateMultiplier: 2.0, label: '60 - 90 min' },
      { step: 4, durationMins: 30,   rateMultiplier: 3.0, label: '90 - 120 min' },
      { step: 5, durationMins: 30,   rateMultiplier: 4.0, label: '120 - 150 min' },
      { step: 6, durationMins: null, rateMultiplier: 5.0, label: '> 150 min (Max Rate)' },
    ],
    dosingInfo: 'PI total dose: 300 to 600 mg/kg (0.3 to 0.6 g/kg) per infusion.',
  },
  MMN: {
    name: 'Multifocal Motor Neuropathy (MMN)',
    maxRate: 5.4,
    steps: [
      { step: 1, durationMins: 30,   rateMultiplier: 0.5, label: '0 - 30 min' },
      { step: 2, durationMins: 30,   rateMultiplier: 1.0, label: '30 - 60 min' },
      { step: 3, durationMins: 30,   rateMultiplier: 2.0, label: '60 - 90 min' },
      { step: 4, durationMins: 30,   rateMultiplier: 3.0, label: '90 - 120 min' },
      { step: 5, durationMins: 30,   rateMultiplier: 4.0, label: '120 - 150 min' },
      { step: 6, durationMins: null, rateMultiplier: 5.4, label: '> 150 min (Max Rate)' },
    ],
    dosingInfo: 'MMN total dose: 500 to 2400 mg/kg (0.5 to 2.4 g/kg) per month.',
  },
  CIDP: {
    name: 'Chronic Inflammatory Demyelinating Polyneuropathy (CIDP)',
    maxRate: 5.4,
    steps: [
      { step: 1, durationMins: 30,   rateMultiplier: 0.5, label: '0 - 30 min' },
      { step: 2, durationMins: 30,   rateMultiplier: 1.0, label: '30 - 60 min' },
      { step: 3, durationMins: 30,   rateMultiplier: 2.0, label: '60 - 90 min' },
      { step: 4, durationMins: 30,   rateMultiplier: 3.0, label: '90 - 120 min' },
      { step: 5, durationMins: 30,   rateMultiplier: 4.0, label: '120 - 150 min' },
      { step: 6, durationMins: null, rateMultiplier: 5.4, label: '> 150 min (Max Rate)' },
    ],
    dosingInfo: 'CIDP Induction: 2 g/kg over 2-5 days. Maintenance: 1 g/kg over 1-4 days, every 3 weeks.',
  },
};

export function IVIGRateCalculator() {
  const [condition, setCondition] = useState<ConditionType>('PI');
  const [inputWeight, setInputWeight] = useState<number | ''>('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [doseGrams, setDoseGrams] = useState<number | ''>('');
  const [copied, setCopied] = useState(false);

  const weightKg = useMemo<number | ''>(() => {
    if (inputWeight === '') return '';
    return weightUnit === 'kg' ? inputWeight : inputWeight / 2.20462;
  }, [inputWeight, weightUnit]);

  const dosageData = useMemo(() => {
    if (weightKg === '' || isNaN(weightKg) || weightKg <= 0) return null;

    const totalVolume =
      doseGrams && !isNaN(doseGrams) && doseGrams > 0 ? (doseGrams as number) * 10 : 0;

    let remainingVolume = totalVolume;
    let totalDurationMins = 0;

    const stepsData = Protocols[condition].steps;

    const steps = stepsData.map(stepDef => {
      const rateMlHr = Math.round(weightKg * stepDef.rateMultiplier * 10) / 10;

      let stepDuration = stepDef.durationMins ?? 0;
      let stepVolume = 0;
      let completedInThisStep = false;

      if (totalVolume > 0) {
        if (remainingVolume <= 0.01) {
          return { ...stepDef, rateMlHr, actualDuration: 0, actualVolume: 0, skipped: true, isFinal: false };
        }

        const maxVolumeForStep = stepDef.durationMins
          ? (rateMlHr * stepDef.durationMins) / 60
          : Infinity;

        if (remainingVolume <= maxVolumeForStep + 0.01) {
          stepVolume = remainingVolume;
          stepDuration = (remainingVolume / rateMlHr) * 60;
          remainingVolume = 0;
          completedInThisStep = true;
        } else {
          stepVolume = maxVolumeForStep;
          remainingVolume -= stepVolume;
        }
        totalDurationMins += stepDuration;
      }

      return {
        ...stepDef,
        rateMlHr,
        actualDuration: stepDuration,
        actualVolume: stepVolume,
        skipped: false,
        isFinal: completedInThisStep,
      };
    });

    const titrationDurationMins = steps
      .filter(s => !s.skipped && s.step < stepsData.length)
      .reduce((sum, s) => sum + (s.actualDuration as number), 0);

    return {
      steps: steps.filter(s => !s.skipped),
      totalVolume,
      totalDurationMins,
      titrationDurationMins,
      hasTotalDose: totalVolume > 0,
    };
  }, [weightKg, doseGrams, condition]);

  const chartData = useMemo(() => {
    if (!dosageData || dosageData.steps.length === 0) return [];
    let cumulativeTime = 0;
    const data: { time: number; rate: number; phase: string; multiplier: number }[] = [];

    const getPhaseName = (stepNum: number) =>
      stepNum === 1 ? 'Initial Infusion Rate' : stepNum === 6 ? 'Max Infusion Rate' : 'Maintenance Infusion Rate';

    data.push({
      time: 0,
      rate: dosageData.steps[0].rateMlHr,
      phase: `Phase 1: ${getPhaseName(1)}`,
      multiplier: dosageData.steps[0].rateMultiplier,
    });

    dosageData.steps.forEach((step, index) => {
      const dur = dosageData.hasTotalDose ? (step.actualDuration as number) : (step.durationMins || 60);
      cumulativeTime += dur;
      const nextStep = index + 1 < dosageData.steps.length ? dosageData.steps[index + 1] : step;
      data.push({
        time: Math.round(cumulativeTime),
        rate: nextStep.rateMlHr,
        phase: `Phase ${nextStep.step}: ${getPhaseName(nextStep.step)}`,
        multiplier: nextStep.rateMultiplier,
      });
    });

    return data;
  }, [dosageData]);

  const copyToClipboard = async () => {
    if (!dosageData) return;

    const displayWeight =
      weightUnit === 'lbs'
        ? `${inputWeight} lbs (${typeof weightKg === 'number' ? weightKg.toFixed(1) : weightKg} kg)`
        : `${weightKg} kg`;

    let plainText = `IVIG (GAMMAGARD 10%) Infusion Rate Protocol\n`;
    plainText += `Condition: ${Protocols[condition].name}\n`;
    plainText += `Patient Weight: ${displayWeight}\n`;

    let htmlText = `<div style="font-family: sans-serif;">
      <strong>IVIG (GAMMAGARD 10%) Infusion Rate Protocol</strong><br/>
      <strong>Condition:</strong> ${Protocols[condition].name}<br/>
      <strong>Patient Weight:</strong> ${displayWeight}<br/>`;

    if (doseGrams) {
      const gPerKg = ((doseGrams as number) / (weightKg as number)).toFixed(2);
      plainText += `Total Dose: ${doseGrams} g (${gPerKg} g/kg)\n`;
      plainText += `Total Volume: ${dosageData.totalVolume} mL\n`;

      htmlText += `<strong>Total Dose:</strong> ${doseGrams} g (${gPerKg} g/kg)<br/>
      <strong>Total Volume:</strong> ${dosageData.totalVolume} mL<br/>`;

      const totalRounded = Math.round(dosageData.totalDurationMins);
      plainText += `Estimated Duration: ${Math.floor(totalRounded / 60)} hrs ${totalRounded % 60} mins\n`;
      htmlText += `<strong>Estimated Duration:</strong> ${Math.floor(totalRounded / 60)} hrs ${totalRounded % 60} mins<br/>`;

      if (dosageData.steps.length > 0) {
        plainText += `Final Target Rate: ${dosageData.steps[dosageData.steps.length - 1].rateMlHr} mL/hr\n`;
        htmlText += `<strong>Final Target Rate:</strong> ${dosageData.steps[dosageData.steps.length - 1].rateMlHr} mL/hr<br/>`;
      }
    }

    plainText += `\nTitration Schedule:\n`;
    htmlText += `<br/><strong>Titration Schedule:</strong><br/>
      <table border="1" cellpadding="5" style="border-collapse: collapse; text-align: left; margin-top: 8px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th>Phase</th>
          <th>Description</th>
          <th>mL/kg/hr</th>
          <th>mL/hr</th>
          <th>VTBI</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>`;

    const p = (str: string | number, len: number) => String(str).padEnd(len, ' ');
    plainText +=
      p('Phase', 5) + ' | ' +
      p('Description', 25) + ' | ' +
      p('mL/kg/hr', 8) + ' | ' +
      p('mL/hr', 8) + ' | ' +
      p('VTBI', 10) + ' | ' +
      p('Duration', 8) + '\n';
    plainText += '-'.repeat(79) + '\n';

    dosageData.steps.forEach(step => {
      const phaseName =
        step.step === 1 ? 'Initial Infusion Rate' : step.step === 6 ? 'Max Infusion Rate' : 'Maintenance Infusion Rate';
      let vtbiStr = '--';
      let durStr = '--';

      if (dosageData.hasTotalDose) {
        if ((step.actualVolume as number) > 0.01) {
          vtbiStr = `${(step.actualVolume as number).toFixed(1)} mL`;
          durStr = `${Math.round(step.actualDuration as number)} min`;
        }
      } else if (step.durationMins) {
        durStr = `${step.durationMins} min`;
      }

      plainText +=
        p(step.step, 5) + ' | ' +
        p(phaseName, 25) + ' | ' +
        p(step.rateMultiplier.toFixed(1), 8) + ' | ' +
        p(step.rateMlHr.toFixed(1), 8) + ' | ' +
        p(vtbiStr, 10) + ' | ' +
        p(durStr, 8) + '\n';

      htmlText += `<tr>
        <td>${step.step}</td>
        <td>${phaseName}</td>
        <td>${step.rateMultiplier.toFixed(1)}</td>
        <td>${step.rateMlHr.toFixed(1)}</td>
        <td>${vtbiStr}</td>
        <td>${durStr}</td>
      </tr>`;
    });

    htmlText += `</tbody></table></div>`;

    try {
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([htmlText], { type: 'text/html' }),
      });
      await navigator.clipboard.write([clipboardItem]);
    } catch {
      await navigator.clipboard.writeText(plainText);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-white tracking-tight">IVIG Rate Calculator</h3>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase">
              Gammagard 10% Protocol
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            Protocol-based titration for nursing administration and documentation.
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          disabled={!dosageData}
          className="bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied for EMR!' : 'Copy Chart for EMR'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left – inputs */}
        <div className="md:col-span-4 space-y-4">
          {/* Condition */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Condition
            </label>
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
              {(['PI', 'MMN', 'CIDP'] as ConditionType[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setCondition(opt)}
                  className={`flex-1 py-2 px-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    condition === opt
                      ? 'bg-violet-500/80 text-white shadow-md border border-violet-400/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <span className="text-sm font-semibold text-slate-200 block mb-1">
                {Protocols[condition].name}
              </span>
              <p className="text-[11px] text-slate-500 italic leading-relaxed">
                {Protocols[condition].dosingInfo}
              </p>
            </div>
          </div>

          {/* Weight */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <label htmlFor="ivig-weight" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Patient Weight
            </label>
            <div className="relative flex items-center justify-between">
              <input
                id="ivig-weight"
                type="number"
                min="1"
                step="0.1"
                value={inputWeight}
                onChange={e => setInputWeight(e.target.value === '' ? '' : Number(e.target.value))}
                className="bg-transparent text-4xl font-light text-white w-full border-none focus:outline-none focus:ring-0 selection:bg-blue-500/30 placeholder-white/20"
                placeholder="0"
              />
              <div className="flex bg-black/40 rounded-lg p-1 border border-white/10 shadow-inner flex-shrink-0">
                <button
                  onClick={() => setWeightUnit('kg')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 ${
                    weightUnit === 'kg'
                      ? 'bg-violet-500 text-white shadow-[0_2px_10px_-2px_rgba(139,92,246,0.5)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  KG
                </button>
                <button
                  onClick={() => setWeightUnit('lbs')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-wider transition-all duration-200 ${
                    weightUnit === 'lbs'
                      ? 'bg-violet-500 text-white shadow-[0_2px_10px_-2px_rgba(139,92,246,0.5)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  LBS
                </button>
              </div>
            </div>
            {weightUnit === 'lbs' && inputWeight !== '' && (
              <div className="mt-2 text-violet-400/80 text-xs font-medium">
                ≈ {typeof weightKg === 'number' ? weightKg.toFixed(2) : ''} kg
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-[11px] text-slate-500 italic">Calculated at 0.5 mL/kg/hr initial step</p>
            </div>
          </div>

          {/* Total dose */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex justify-between items-start mb-3">
              <label htmlFor="ivig-dose" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Dose
              </label>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Optional</span>
            </div>
            <div className="relative flex items-center">
              <input
                id="ivig-dose"
                type="number"
                min="1"
                step="0.1"
                value={doseGrams}
                onChange={e => setDoseGrams(e.target.value === '' ? '' : Number(e.target.value))}
                className="bg-transparent text-3xl font-light text-white w-full border-none focus:outline-none focus:ring-0 selection:bg-blue-500/30 placeholder-white/20"
                placeholder="0"
              />
              <span className="text-xl text-slate-500 ml-2 font-light uppercase">g</span>
            </div>
          </div>

          {/* Admin summary */}
          {dosageData && dosageData.hasTotalDose && (
            <div className="bg-violet-500/10 rounded-2xl p-5 border border-violet-500/20 shadow-inner">
              <h4 className="text-violet-300 text-xs font-semibold mb-3 uppercase tracking-wider">Administration Summary</h4>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Total Volume</span>
                  <span className="text-white font-medium text-sm">{dosageData.totalVolume} mL</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Dose per Weight</span>
                  <span className="text-white font-medium text-sm">
                    {((doseGrams as number) / (weightKg as number)).toFixed(2)} g/kg
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Titration Duration</span>
                  <span className="text-white font-medium text-sm">{Math.round(dosageData.titrationDurationMins)} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs">Max Target Rate</span>
                  <span className="text-white font-medium text-sm">
                    {dosageData.steps[dosageData.steps.length - 1]?.rateMlHr || '--'} mL/hr
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-violet-500/20">
                  <span className="text-violet-200 text-xs font-medium">Est. Completion</span>
                  <span className="text-white font-bold text-sm">
                    {Math.floor(Math.round(dosageData.totalDurationMins) / 60)}h{' '}
                    {Math.round(dosageData.totalDurationMins) % 60}m
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right – schedule table & chart */}
        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-wider hidden sm:table-header-group">
                <tr>
                  <th className="px-5 py-3">Step / Phase</th>
                  <th className="px-5 py-3 text-left">Rate</th>
                  <th className="px-5 py-3 text-center">VTBI</th>
                  <th className="px-5 py-3 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {!dosageData ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <Calculator className="w-10 h-10 text-slate-600/50 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium text-sm">Ready to calculate</p>
                      <p className="text-xs text-slate-500 mt-1">Enter patient weight to generate chart</p>
                    </td>
                  </tr>
                ) : (
                  dosageData.steps.map((step, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                        step.isFinal ? 'bg-violet-500/5' : ''
                      } block sm:table-row`}
                    >
                      <td className="px-5 py-3 sm:py-4 block sm:table-cell border-b sm:border-0 border-white/5 sm:w-1/3">
                        <div className={`font-bold mb-0.5 text-sm ${step.isFinal ? 'text-violet-300' : 'text-slate-200'}`}>
                          Phase {step.step}
                        </div>
                        <div className={`text-xs font-medium leading-snug mb-1 break-words ${step.isFinal ? 'text-violet-300/90' : 'text-slate-300'}`}>
                          {step.step === 1 ? 'Initial Infusion Rate' : step.step === 6 ? 'Max Infusion Rate' : 'Maintenance Infusion Rate'}
                        </div>
                        <div className={`text-[10px] uppercase tracking-wider font-semibold space-x-1 ${step.isFinal ? 'text-violet-400/70' : 'text-slate-400'}`}>
                          <span>{step.rateMultiplier.toFixed(1)} mL/kg/hr</span>
                          <span className="opacity-50">|</span>
                          <span>{step.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2 sm:py-4 text-left block sm:table-cell bg-white/5 sm:bg-transparent">
                        <div className="sm:hidden text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Rate</div>
                        <div className="font-mono text-lg">
                          <span className={step.isFinal ? 'text-violet-300' : 'text-white'}>
                            {step.rateMlHr.toFixed(1)}
                          </span>
                          <span className="text-[10px] opacity-50 ml-1">mL/hr</span>
                        </div>
                      </td>
                      <td className="px-5 py-2 sm:py-4 text-left sm:text-center block sm:table-cell bg-white/5 sm:bg-transparent">
                        <div className="sm:hidden text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">VTBI</div>
                        {dosageData.hasTotalDose && (step.actualVolume as number) > 0.01 ? (
                          <>
                            <span className="font-mono text-base text-emerald-400">
                              {(step.actualVolume as number).toFixed(1)}
                            </span>
                            <span className="text-[10px] text-emerald-400/60 ml-1">mL</span>
                          </>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3 sm:py-4 text-left sm:text-right text-xs font-mono opacity-80 block sm:table-cell bg-white/5 sm:bg-transparent">
                        <div className="sm:hidden text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Duration</div>
                        {dosageData.hasTotalDose
                          ? `${Math.round(step.actualDuration as number)} min`
                          : step.durationMins
                          ? `${step.durationMins} min`
                          : '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {dosageData && dosageData.steps.length > 0 && (
            <div className="bg-black/20 rounded-2xl p-5 border border-white/5">
              <h4 className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-4">
                Titration Curve <span className="text-slate-500 font-normal normal-case">(mL/hr over Time)</span>
              </h4>
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ivigRate" x1="0" y1="0" x2="0" y2="1">
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
                          const pData = payload[0].payload as { phase?: string; multiplier?: number };
                          return (
                            <div className="bg-[#0f0f10] border border-white/10 rounded-xl p-3 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.5)] backdrop-blur-xl min-w-[170px]">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">
                                  Time: {label}m
                                </span>
                                <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                              </div>
                              <div className="flex items-baseline gap-1.5 mb-1">
                                <span className="text-violet-400 font-bold text-2xl leading-none">
                                  {(payload[0].value as number).toFixed(1)}
                                </span>
                                <span className="text-violet-400/60 text-xs font-semibold">mL/hr</span>
                              </div>
                              {pData.phase && (
                                <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
                                  <p className="text-slate-200 text-xs font-medium">{pData.phase}</p>
                                  {pData.multiplier !== undefined && (
                                    <p className="text-slate-500 text-[10px] font-medium">
                                      {pData.multiplier.toFixed(1)} mL/kg/hr
                                    </p>
                                  )}
                                </div>
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
                      fill="url(#ivigRate)"
                      activeDot={{ r: 5, fill: '#a78bfa', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200/70 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 text-amber-500/70 mt-0.5" />
            <div>
              Disclaimer: This tool is intended as a clinical reference and does not replace medical judgment. Rate
              increases should only occur if the patient is tolerating the current rate.
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
            <a
              href="https://www.gammagard.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-violet-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Gammagard Official Website</span>
            </a>
            <span className="hidden sm:inline text-slate-600">•</span>
            <a
              href="https://www.shirecontent.com/PI/PDFs/GAMMAGARDLIQUID_USA_ENG.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-violet-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Prescribing Information (PDF)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
