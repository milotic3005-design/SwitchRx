/** What a main answer's colour says. Neutral unless the calculator computes a clinical signal for it. */
export type AnswerTone = 'neutral' | 'info' | 'ok' | 'caution' | 'alert';

// Amber and rose mean a clinical signal in this app, so they appear only for the caution and alert tones.
const TONES: Record<AnswerTone, { box: string; value: string }> = {
  neutral: { box: 'bg-white/5 border-white/10', value: 'text-white' },
  info: { box: 'bg-blue-500/10 border-blue-500/20', value: 'text-blue-400' },
  ok: { box: 'bg-emerald-500/10 border-emerald-500/20', value: 'text-emerald-400' },
  caution: { box: 'bg-amber-500/10 border-amber-500/20', value: 'text-amber-400' },
  alert: { box: 'bg-rose-500/10 border-rose-500/20', value: 'text-rose-400' },
};

/**
 * A calculator's main answer in the one shared style: a label, the number large, its unit beside it.
 * `value` is null until the inputs give an answer. The `.answer-*` classes live in app/globals.css, so
 * tables and bespoke result blocks can use the same style without this component.
 */
export function MainAnswer({
  label,
  value,
  unit,
  tone = 'neutral',
  className = 'mt-6',
}: {
  label: string;
  value: string | null;
  unit?: string;
  tone?: AnswerTone;
  className?: string;
}) {
  const { box, value: valueColour } = TONES[value === null ? 'neutral' : tone];
  return (
    <div className={`rounded-xl border p-4 ${box} ${className}`}>
      <div className="answer-label">{label}</div>
      {value !== null ? (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className={`answer-value ${valueColour}`}>{value}</span>
          {unit && <span className="answer-unit">{unit}</span>}
        </div>
      ) : (
        <div className="mt-1 text-[13px] italic text-slate-500">Enter values above</div>
      )}
    </div>
  );
}
