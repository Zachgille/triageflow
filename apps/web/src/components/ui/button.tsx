import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
        variant === 'ghost' && 'border-transparent bg-transparent hover:bg-muted',
        variant === 'danger' && 'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90',
        className,
      )}
      {...props}
    />
  );
}
