import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const TONES = {
  neutral: 'bg-white/5 border-white/10',
  violet: 'bg-violet-500/10 border-violet-500/20',
} as const;

/** A titled section of a tool: a soft tint, a hairline border, and a header row with a violet icon. */
export function SectionCard({
  icon: Icon,
  title,
  tone = 'neutral',
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${TONES[tone]} rounded-2xl p-5 border${className ? ` ${className}` : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
        <h4 className="text-[13px] font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
      </div>
      {children}
    </div>
  );
}
