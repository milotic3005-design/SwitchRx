import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { SafetyFlag } from '@/lib/pharmacy-lookup';

// Rose and amber are reserved for safety signals; the light-theme shades are deeper for contrast on parchment.
const TONE = {
  critical: {
    box: 'border-rose-500/30 bg-rose-500/10',
    text: 'text-rose-300 [html.light_&]:text-rose-800',
    label: 'Critical',
    Icon: ShieldAlert,
  },
  warning: {
    box: 'border-amber-500/30 bg-amber-500/10',
    text: 'text-amber-300 [html.light_&]:text-amber-800',
    label: 'Warning',
    Icon: AlertTriangle,
  },
} as const;

type ShownFlag = SafetyFlag & { level: 'critical' | 'warning' };

const isShown = (flag: SafetyFlag): flag is ShownFlag => flag.level === 'critical' || flag.level === 'warning';

/** The critical and warning safety flags from the pharmacy lookup, critical first. Renders nothing when there are none. */
export function SafetyStrip({ flags }: { flags: SafetyFlag[] }) {
  const shown = flags.filter(isShown);
  shown.sort((a, b) => Number(b.level === 'critical') - Number(a.level === 'critical'));
  if (shown.length === 0) return null;

  return (
    <div role="group" aria-label="Safety flags" className="space-y-2">
      {shown.map((flag, i) => {
        const tone = TONE[flag.level];
        return (
          <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${tone.box}`}>
            <tone.Icon size={15} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${tone.text}`} aria-hidden="true" />
            <p className={`min-w-0 text-[13px] leading-snug ${tone.text}`}>
              <span className="font-bold uppercase tracking-wider">{tone.label}</span>
              {flag.drug && <span className="font-semibold">{` · ${flag.drug}`}</span>}
              {` — ${flag.message}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
