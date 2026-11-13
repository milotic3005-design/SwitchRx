import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const TONES = {
  neutral: { box: 'bg-white/5 border-white/10', title: 'text-slate-400' },
  violet: { box: 'bg-violet-500/10 border-violet-500/20', title: 'text-violet-300' },
} as const;

/**
 * A titled section of a tool: a soft tint, a hairline border, and a header row with a violet icon.
 * `tone="violet"` marks a summary. `action` (such as a unit switch) sits at the right of the header row.
 */
export function SectionCard({
  icon: Icon,
  title,
  tone = 'neutral',
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  tone?: keyof typeof TONES;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${TONES[tone].box} rounded-2xl p-5 border${className ? ` ${className}` : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
          <h4 className={`text-[13px] font-bold uppercase tracking-wider ${TONES[tone].title}`}>{title}</h4>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
