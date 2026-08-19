'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, X, AlertTriangle, Check, Info, ExternalLink, Droplets,
  Minus, Plus, Loader2, ArrowRight, Beaker,
} from 'lucide-react';
import {
  DILUENT_VOLUME_DB, METHOD_META, resolveDiluentEntry, searchDiluentEntries,
  computePrep, scanFdaLabelForPrep, recommendBagSize, formatConcentration,
  BAG_STEP_UP_THRESHOLD_ML, BAG_STEP_UP_TARGET_ML,
  type DiluentVolumeEntry, type PrepMethod, type LabelScan,
} from '@/data/diluent-volume';

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors';
const labelCls = 'block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5';

const TONE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   text: 'text-amber-300',   dot: 'bg-amber-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/25',  text: 'text-violet-300',  dot: 'bg-violet-400' },
  slate:   { bg: 'bg-white/5',        border: 'border-white/10',       text: 'text-slate-300',   dot: 'bg-slate-400' },
};

// Drugs worth one-tap access — the two ends of the contrast plus the highest-volume
// infusion-clinic products.
const QUICK_PICKS = ['tocilizumab', 'infliximab', 'vedolizumab', 'ustekinumab-iv', 'rituximab', 'natalizumab'];

const fmt = (n: number, dp = 1) =>
  Number.isInteger(n) ? String(n) : n.toFixed(dp).replace(/\.0+$/, '');

/* ── Verdict headline ─────────────────────────────────────────── */
function Verdict({ method, subject }: { method: PrepMethod | 'unknown'; subject: string }) {
  const meta = method === 'unknown' ? null : METHOD_META[method];
  const tone = TONE[meta?.tone ?? 'slate'];
  return (
    <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-5`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${tone.dot}`} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{subject}</p>
          <h3 className={`text-xl font-bold leading-snug ${tone.text}`}>
            {meta ? meta.verdict : 'Technique not determined'}
          </h3>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            {meta
              ? meta.answer
              : 'The label text did not contain a recognisable preparation instruction. Read the prescribing information directly before compounding.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Numbered preparation steps ───────────────────────────────── */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((node, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed">
          <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-slate-300 flex items-center justify-center">
            {i + 1}
          </span>
          <span>{node}</span>
        </li>
      ))}
    </ol>
  );
}

/* ── Volume ledger: bag → discard → drug → final ──────────────── */
function VolumeLedger({
  bagVolume, discardVolume, drugVolume, finalVolume, finalConcentration, unitLabel,
}: {
  bagVolume: number; discardVolume: number; drugVolume: number;
  finalVolume: number; finalConcentration: number | null; unitLabel: string;
}) {
  const rows: { label: string; value: string; icon?: React.ReactNode; muted?: boolean }[] = [
    { label: 'Starting bag', value: `${fmt(bagVolume)} mL` },
  ];
  if (discardVolume > 0) {
    rows.push({
      label: 'Withdraw & discard',
      value: `− ${fmt(discardVolume)} mL`,
      icon: <Minus className="w-3 h-3" />,
    });
  }
  rows.push({
    label: 'Drug added',
    value: `+ ${fmt(drugVolume)} mL`,
    icon: <Plus className="w-3 h-3" />,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <span className="text-[13px] text-slate-400 flex items-center gap-1.5">
            {r.icon}{r.label}
          </span>
          <span className="text-[13px] font-semibold text-slate-200 tabular-nums">{r.value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.04]">
        <span className="text-[13px] font-bold text-white">Final volume in bag</span>
        <span className="text-base font-bold text-white tabular-nums">{fmt(finalVolume)} mL</span>
      </div>
      {finalConcentration !== null && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
          <span className="text-[13px] text-slate-400">Final concentration</span>
          <span className="text-[13px] font-semibold text-slate-200 tabular-nums">
            {fmt(finalConcentration, 2)} {unitLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Label quote block ────────────────────────────────────────── */
function LabelQuote({ quote, source, url, provenance = 'label' }: {
  quote: string; source: string; url?: string; provenance?: 'label' | 'institutional';
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        {provenance === 'institutional' ? 'Institutional standard' : 'What the label says'}
      </p>
      <blockquote className="border-l-2 border-white/20 pl-3 text-[13px] text-slate-300 leading-relaxed italic">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>{source}</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View label
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Curated result panel ─────────────────────────────────────── */
// Rendered with key={entry.id} so selecting a different drug remounts this and
// discards the previous drug's bag size, dose and volume — the React-recommended
// way to reset state on identity change, rather than resetting inside an effect.
function CuratedResult({ entry }: { entry: DiluentVolumeEntry }) {
  const [bag, setBag] = useState<number | null>(null);
  const [dose, setDose] = useState('');
  const [volume, setVolume] = useState('');
  // Once the user edits the volume directly, stop deriving it from the dose.
  const [volumeTouched, setVolumeTouched] = useState(false);

  const doseNum = dose.trim() === '' ? null : parseFloat(dose);
  const validDose = doseNum !== null && isFinite(doseNum) && doseNum > 0 ? doseNum : null;

  // Volume comes from the dose and the vial strength unless the user typed one.
  const derivedVolume =
    validDose !== null && entry.vialConcentration ? validDose / entry.vialConcentration : null;
  const shownVolume = volumeTouched || derivedVolume === null ? volume : fmt(derivedVolume, 2);
  const volNum = parseFloat(shownVolume);
  const validVolume = isFinite(volNum) && volNum > 0 ? volNum : null;

  // Bag tracks the dose and volume until the user picks one explicitly (`bag`
  // stays null while unpicked, so the recommendation keeps updating).
  const recommendation = useMemo(
    () => recommendBagSize(entry, validVolume, validDose),
    [entry, validVolume, validDose],
  );
  const bagVolume = bag ?? recommendation.bag;
  // Flag an explicit choice that disagrees with the recommendation, plus the
  // case where the volume rule fired but the drug lists no large-enough bag.
  const bagAdvised =
    (bagVolume !== recommendation.bag || recommendation.unavailable === true) &&
    validVolume !== null;

  const math = useMemo(
    () =>
      validVolume === null
        ? null
        : computePrep(entry.method, bagVolume, validVolume, validDose, entry.concentrationRange),
    [entry.method, entry.concentrationRange, bagVolume, validVolume, validDose],
  );

  const meta = METHOD_META[entry.method];
  const tone = TONE[meta.tone];
  const diluent = entry.diluents[0];
  const v = validVolume === null ? null : fmt(validVolume, 2);
  // IV irons are dosed and limited in mg of elemental iron, not mg of salt.
  const isIron = /^(ferric-|iron-)/.test(entry.id);
  const concUnit = isIron ? 'mg iron/mL' : 'mg/mL';

  // Preparation steps, worded per technique.
  const steps: React.ReactNode[] = [];
  if (entry.method === 'special') {
    steps.push(entry.practicePoint ?? 'Follow the label preparation instructions.');
  } else {
    if (entry.reconstituted) {
      steps.push(
        <>Reconstitute the vial(s) as directed{entry.vialConcentration ? <> — the reconstituted solution is <strong className="text-slate-200">{fmt(entry.vialConcentration, 2)} mg/mL</strong></> : null}.</>,
      );
    }
    steps.push(
      <>Draw up <strong className="text-slate-200">{v ? `${v} mL` : 'the dose volume'}</strong> of {entry.generic}.</>,
    );
    if (entry.method === 'remove-from-bag') {
      steps.push(
        <>
          <strong className={tone.text}>Withdraw and discard {v ? `${v} mL` : 'an equal volume'}</strong> of{' '}
          {diluent} from the {fmt(bagVolume)} mL bag <em className="text-slate-400">before</em> adding the drug.
        </>,
      );
      steps.push(
        <>Add the drug to the bag. The final volume is <strong className="text-slate-200">{fmt(bagVolume)} mL</strong>.</>,
      );
    } else if (entry.method === 'add-to-bag') {
      steps.push(
        <>
          Add the drug straight into the full {fmt(bagVolume)} mL bag of {diluent}.{' '}
          <strong className={tone.text}>Do not remove any diluent first.</strong>
        </>,
      );
      steps.push(
        <>Final volume is <strong className="text-slate-200">{math ? `${fmt(math.finalVolume)} mL` : `${fmt(bagVolume)} mL + the drug volume`}</strong>.</>,
      );
    } else {
      const rangeText = entry.concentrationRange
        ? formatConcentration(entry.concentrationRange, concUnit)
        : 'the label limits';
      steps.push(
        <>
          Add the drug to the {fmt(bagVolume)} mL bag of {diluent}, sized so the final concentration stays
          within <strong className="text-slate-200">{rangeText}</strong>.{' '}
          <strong className={tone.text}>No withdrawal step is needed</strong> — the concentration window is
          what governs, not the bag volume.
        </>,
      );
      if (entry.labelDirectsWithdrawal) {
        steps.push(
          <>
            The label does describe withdrawing an equal volume first. That is equally acceptable; it shifts
            the concentration slightly, not whether the preparation is in spec.
          </>,
        );
      }
      steps.push(
        <>Final volume is <strong className="text-slate-200">{math ? `${fmt(math.finalVolume)} mL` : `${fmt(bagVolume)} mL + the drug volume`}</strong>.</>,
      );
    }
    steps.push(<>Invert gently to mix. Do not shake.</>);
  }

  return (
    <div className="space-y-5">
      <Verdict method={entry.method} subject={`${entry.generic} · ${entry.brand}`} />

      {/* Reference facts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Fact label="Standard bag" value={entry.bagSizes.length ? entry.bagSizes.map(b => `${b} mL`).join(' / ') : 'n/a'} />
        {/* Concentration-driven drugs are prepared additively too — the range, not the
            bag volume, is the constraint — so they report the same final volume rule. */}
        <Fact label="Final volume" value={
          entry.method === 'remove-from-bag' ? 'Fixed = bag size'
          : entry.method === 'special' ? 'See note'
          : 'Bag + drug volume'
        } />
        <Fact label="Diluent" value={entry.diluents[0].replace(/ Injection.*$/, '')} />
        <Fact
          label={entry.provenance === 'institutional' ? 'Concentration limit' : 'Label concentration'}
          value={entry.concentrationRange ? formatConcentration(entry.concentrationRange, concUnit) : 'Not specified'}
        />
      </div>

      {/* Steps */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          Preparation
        </p>
        <Steps items={steps} />
      </div>

      {/* Calculator */}
      {entry.method !== 'special' && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Beaker className="w-3.5 h-3.5" />
            Volume check
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className={labelCls} htmlFor="dv-bag">Bag size</label>
              {entry.bagSizes.length > 1 ? (
                <select
                  id="dv-bag"
                  value={bagVolume}
                  onChange={e => setBag(parseFloat(e.target.value))}
                  className={inputCls}
                >
                  {entry.bagSizes.map(b => (
                    <option key={b} value={b}>{b} mL</option>
                  ))}
                </select>
              ) : (
                <input id="dv-bag" readOnly value={`${fmt(bagVolume)} mL`} className={`${inputCls} opacity-70`} />
              )}
              {recommendation.steppedUp && bag === null && (
                <p className="text-[11px] text-amber-400/90 mt-1">
                  {recommendation.basis === 'dose'
                    ? `Set by the ${fmt(validDose!)} mg dose, per label`
                    : `Stepped up from ${fmt(entry.bagSizes[0])} mL — ${fmt(validVolume!, 2)} mL of drug`}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls} htmlFor="dv-dose">
                Dose ({isIron ? 'mg iron' : 'mg'}) <span className="text-slate-600 normal-case font-medium">optional</span>
              </label>
              <input
                id="dv-dose"
                type="number"
                inputMode="decimal"
                min="0"
                value={dose}
                onChange={e => setDose(e.target.value)}
                placeholder="e.g. 400"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="dv-vol">Drug volume (mL)</label>
              <input
                id="dv-vol"
                type="number"
                inputMode="decimal"
                min="0"
                value={shownVolume}
                onChange={e => { setVolumeTouched(true); setVolume(e.target.value); }}
                placeholder="e.g. 20"
                className={inputCls}
              />
              {!volumeTouched && derivedVolume !== null && (
                <p className="text-[11px] text-slate-500 mt-1">
                  From {fmt(entry.vialConcentration!, 2)} mg/mL — edit to override
                </p>
              )}
            </div>
          </div>

          {math ? (
            <div className="space-y-3">
              <VolumeLedger
                bagVolume={bagVolume}
                discardVolume={math.discardVolume}
                drugVolume={validVolume!}
                finalVolume={math.finalVolume}
                finalConcentration={math.finalConcentration}
                unitLabel={concUnit}
              />

              {/* Bag advisory. Two distinct triggers, neither of which the
                  concentration check can stand in for: a label dose→bag pairing
                  (Ocrevus 600 mg needs 500 mL off just 20 mL of drug), and the
                  volume step-up (100 mL is 40% of a 250 mL bag even when the
                  resulting concentration is perfectly in range). */}
              {bagAdvised && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-[13px] text-amber-200 leading-relaxed">
                    {recommendation.unavailable ? (
                      <>
                        <span className="font-semibold">
                          {fmt(validVolume!, 2)} mL of drug is too much for a {fmt(bagVolume)} mL bag.
                        </span>{' '}
                        No bag of {BAG_STEP_UP_TARGET_ML} mL or larger is listed for this drug — check the
                        label before proceeding.
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">
                          Use a {fmt(recommendation.bag)} mL bag, not {fmt(bagVolume)} mL.
                        </span>{' '}
                        {recommendation.basis === 'dose'
                          ? <>The label pairs a {fmt(validDose!)} mg dose with a {fmt(recommendation.bag)} mL bag.</>
                          : <>At {BAG_STEP_UP_THRESHOLD_ML} mL of drug and above the bag steps up — here the drug
                             would be {Math.round((validVolume! / bagVolume) * 100)}% of a {fmt(bagVolume)} mL bag.</>}
                        <button
                          onClick={() => setBag(null)}
                          className="ml-2 underline underline-offset-2 font-semibold hover:text-amber-100 transition-colors"
                        >
                          Use {fmt(recommendation.bag)} mL
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* What the other technique would give */}
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  If prepared the other way
                </p>
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  {entry.method === 'remove-from-bag'
                    ? <>Adding to a full bag without withdrawing gives <strong className="text-slate-300">{fmt(math.alternateFinalVolume)} mL</strong></>
                    : <>Withdrawing {fmt(validVolume!, 2)} mL first gives <strong className="text-slate-300">{fmt(math.alternateFinalVolume)} mL</strong></>}
                  {math.alternateConcentration !== null && (
                    <> at <strong className="text-slate-300">{fmt(math.alternateConcentration, 2)} {concUnit}</strong></>
                  )}
                  {math.alternateInRange !== null && (
                    <> — {math.alternateInRange
                      ? <span className="text-emerald-400 font-semibold">still within the label range</span>
                      : <span className="text-amber-400 font-semibold">outside the label range</span>}</>
                  )}
                  .
                </p>
              </div>

              {/* A label volume cap is independent of the concentration window:
                  a big dose in a small bag can satisfy 1-10 mg/mL and still
                  breach Opdivo's 160 mL ceiling. */}
              {entry.maxFinalVolumeMl !== undefined && math.finalVolume > entry.maxFinalVolumeMl && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-amber-200 leading-relaxed">
                    <span className="font-semibold">
                      {fmt(math.finalVolume)} mL exceeds the {fmt(entry.maxFinalVolumeMl)} mL limit
                    </span>{' '}
                    the label sets on total infusion volume. Use a smaller bag.
                  </p>
                </div>
              )}

              {math.inRange === false && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-amber-200 leading-relaxed">
                    {fmt(math.finalConcentration!, 2)} {concUnit} falls outside the label&rsquo;s stated range.
                    Re-check the dose, the bag size, and the drug volume.
                  </p>
                </div>
              )}
              {math.inRange === true && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-emerald-200 leading-relaxed">
                    {fmt(math.finalConcentration!, 2)} {concUnit} is within the label range.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500 italic">
              Enter a dose or a drug volume to see the bag arithmetic.
            </p>
          )}
        </div>
      )}

      {/* Practice point */}
      {entry.practicePoint && entry.method !== 'special' && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-300 mb-1">Watch for</p>
            <p className="text-[13px] text-slate-300 leading-relaxed">{entry.practicePoint}</p>
          </div>
        </div>
      )}

      {entry.pediatricNote && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-300 mb-1">Paediatric</p>
            <p className="text-[13px] text-slate-300 leading-relaxed">{entry.pediatricNote}</p>
          </div>
        </div>
      )}

      <LabelQuote quote={entry.labelQuote} source={entry.sourceLabel} url={entry.sourceUrl} provenance={entry.provenance} />

      {entry.biosimilars?.length && (
        <p className="text-[12px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-400">Biosimilars / alternate brands:</span>{' '}
          {entry.biosimilars.join(', ')}. Preparation above is taken from the reference product label —
          confirm against the specific product&rsquo;s own insert, as bag size and technique can differ.
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-[13px] font-semibold text-slate-200 leading-snug">{value}</p>
    </div>
  );
}

/* ── openFDA fallback panel ───────────────────────────────────── */
function ScanResult({ query, scan }: { query: string; scan: LabelScan }) {
  const name = scan.genericName || scan.brandName || query;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-200 leading-relaxed">
          Not in the verified set. This reading was derived automatically from the FDA label text and has
          not been checked by a pharmacist — treat it as a pointer to the label, not as an answer.
        </p>
      </div>

      <Verdict method={scan.method} subject={name} />

      {scan.matchedSentence && (
        <LabelQuote
          quote={scan.matchedSentence}
          source="openFDA — Dosage & Administration, current label"
          url={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(name)}`}
        />
      )}

      {!scan.matchedSentence && (
        <p className="text-[13px] text-slate-400 leading-relaxed">
          No preparation sentence matched. Open the label and read the Dosage &amp; Administration section in full.
        </p>
      )}

      {scan.bagSizes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Fact label="Bag sizes named in label" value={scan.bagSizes.map(b => `${b} mL`).join(' / ')} />
          {scan.concentrationRange && (
            <Fact
              label="Concentration range"
              value={`${fmt(scan.concentrationRange.min, 2)}–${fmt(scan.concentrationRange.max, 2)} mg/mL`}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export function DiluentVolumeAdvisor() {
  const [query, setQuery] = useState('');
  const [entry, setEntry] = useState<DiluentVolumeEntry | null>(null);
  const [scan, setScan] = useState<{ query: string; scan: LabelScan } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => searchDiluentEntries(query), [query]);

  // Close the type-ahead when focus leaves the search box.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const select = (e: DiluentVolumeEntry) => {
    setEntry(e);
    setScan(null);
    setScanError(null);
    setQuery(`${e.generic} (${e.brand})`);
    setShowSuggestions(false);
  };

  const submit = async () => {
    const q = query.trim();
    if (!q) return;
    setShowSuggestions(false);

    const match = resolveDiluentEntry(q);
    if (match) {
      select(match);
      return;
    }

    // Not curated — fall back to reading the drug's FDA label.
    setEntry(null);
    setScan(null);
    setScanError(null);
    setScanning(true);
    try {
      const result = await scanFdaLabelForPrep(q);
      if (result) setScan({ query: q, scan: result });
      else setScanError(`No FDA label found for "${q}". Check the spelling, or try the generic name.`);
    } catch {
      setScanError('Could not reach the FDA label service. Check the connection and try again.');
    } finally {
      setScanning(false);
    }
  };

  const clear = () => {
    setQuery('');
    setEntry(null);
    setScan(null);
    setScanError(null);
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Enter a drug and this tells you whether the diluent bag has to be drawn down before the drug goes in
          (final volume fixed by the label) or the drug volume can simply be added on top (final volume = bag +
          drug). <span className="text-slate-300 font-semibold">{DILUENT_VOLUME_DB.length} drugs</span> are
          verified against their prescribing information; anything else is read live from the FDA label.
          Where the drug volume reaches {BAG_STEP_UP_THRESHOLD_ML} mL, the bag steps up to{' '}
          {BAG_STEP_UP_TARGET_ML} mL automatically.
        </p>
      </div>

      {/* Search */}
      <div ref={boxRef} className="relative">
        <label className={labelCls} htmlFor="dv-search">Drug name</label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            id="dv-search"
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); if (suggestions[0] && showSuggestions) select(suggestions[0]); else submit(); }
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
            placeholder="Generic or brand name — e.g. Actemra, infliximab, Entyvio"
            autoComplete="off"
            className="w-full pl-11 pr-24 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
          />
          {query && (
            <button
              onClick={clear}
              aria-label="Clear"
              className="absolute right-[86px] top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={submit}
            disabled={!query.trim() || scanning}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-[12px] font-bold text-white transition-colors flex items-center gap-1.5"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Check
          </button>
        </div>

        {/* Type-ahead */}
        {/* Type-ahead. The background is the opaque page-ground token, not a literal
            hex: it follows light mode, and unlike the translucent panel tokens it
            stops the quick-pick chips underneath from showing through the list. */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: 'var(--cc-ink)' }}
          >
            {suggestions.map(s => {
              const meta = METHOD_META[s.method];
              return (
                <li key={s.id}>
                  <button
                    onClick={() => select(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-semibold text-white">{s.generic}</span>
                      <span className="text-[12px] text-slate-500 ml-2">{s.brand}</span>
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex-shrink-0 ${TONE[meta.tone].bg} ${TONE[meta.tone].border} ${TONE[meta.tone].text}`}>
                      {s.method === 'remove-from-bag' ? 'Remove'
                        : s.method === 'add-to-bag' ? 'Add'
                        : s.method === 'concentration-driven' ? 'By conc.'
                        : 'Special'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Quick picks */}
      {!entry && !scan && !scanning && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Common</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PICKS.map(id => {
              const e = DILUENT_VOLUME_DB.find(d => d.id === id);
              if (!e) return null;
              return (
                <button
                  key={id}
                  onClick={() => select(e)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
                >
                  {e.brand}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {scanning && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <Loader2 className="w-6 h-6 mx-auto mb-3 text-slate-500 animate-spin" />
          <p className="text-sm text-slate-400">Reading the FDA label&hellip;</p>
        </div>
      )}

      {scanError && !scanning && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <Droplets className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">{scanError}</p>
        </div>
      )}

      {entry && <CuratedResult key={entry.id} entry={entry} />}
      {scan && !entry && <ScanResult query={scan.query} scan={scan.scan} />}

      {/* Standing caveat */}
      {(entry || scan) && (
        <p className="text-[12px] text-slate-500 leading-relaxed border-t border-white/5 pt-4">
          Prescribing information is revised without notice, and institutional compounding standards may direct a
          different technique. Confirm against the current label and your own policy before compounding.
        </p>
      )}
    </div>
  );
}
