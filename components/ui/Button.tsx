import type { ButtonHTMLAttributes } from 'react';
import { primaryButtonClass, quietButtonClass } from './styles';

const VARIANTS = { primary: primaryButtonClass, quiet: quietButtonClass } as const;

/** A primary (gold, the screen's main action) or quiet (secondary) button. Extra classes go after the variant's. */
export function Button({
  variant,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant: keyof typeof VARIANTS }) {
  return <button type={type} className={className ? `${VARIANTS[variant]} ${className}` : VARIANTS[variant]} {...props} />;
}
