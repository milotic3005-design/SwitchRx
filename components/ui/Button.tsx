import type { ButtonHTMLAttributes } from 'react';
import { primaryButtonClass, quietButtonClass, smallPrimaryButtonClass } from './styles';

const VARIANTS = { primary: primaryButtonClass, quiet: quietButtonClass } as const;

/**
 * A primary (gold, the screen's main action) or quiet (secondary) button. `size="sm"` is the compact primary.
 * Extra classes go after the variant's; pass only classes that do not restyle it (position, margin, width).
 */
export function Button({
  variant,
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant: keyof typeof VARIANTS; size?: 'md' | 'sm' }) {
  const base = variant === 'primary' && size === 'sm' ? smallPrimaryButtonClass : VARIANTS[variant];
  return <button type={type} className={className ? `${base} ${className}` : base} {...props} />;
}
