// The shared look of fields and buttons across the tools. Tools import these instead of writing their own,
// and lib/ui/match.test.ts fails if a tool in scope styles a field or a primary button itself.

/** A typed field or dropdown: dark fill, hairline border, 16px text, violet focus ring. */
export const fieldClass =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-base font-medium text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50';

/** The label above a field: 13px, bold, uppercase, muted. */
export const labelClass = 'block text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-1.5';

/** A secondary action, such as Copy or Reset. */
export const quietButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

/** The main action of a screen, in the gold `btn-premium` look. One per screen. */
export const primaryButtonClass =
  'btn-premium inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50';

/** A field whose number is the point of the card, such as IVIG's patient weight: the field style at 30px. */
export const largeFieldClass = fieldClass.replace('text-base font-medium', 'text-3xl font-light');
