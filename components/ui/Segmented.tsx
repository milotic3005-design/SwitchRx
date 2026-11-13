import type { ReactNode } from 'react';

/**
 * A mode switch for an either/or choice: a dark track whose chosen option is tinted violet.
 * `value` is '' while nothing is chosen, and then no option is pressed. `size="sm"` fits inside a field.
 * It is as wide as its options; `className="w-full [&>button]:flex-1"` stretches it across its row.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  disabled = false,
  className,
}: {
  options: readonly { value: T; label: ReactNode }[];
  value: T | '';
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'md' | 'sm';
  disabled?: boolean;
  className?: string;
}) {
  const pad = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1.5';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5${disabled ? ' opacity-50' : ''}${className ? ` ${className}` : ''}`}
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`${pad} rounded-md text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${
              active ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
