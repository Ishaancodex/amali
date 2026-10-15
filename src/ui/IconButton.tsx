'use client';

import { cn } from '@/lib/cn';
import type { LucideIcon } from './icons';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: 'default' | 'glass';
}

export function IconButton({
  icon: Icon,
  label,
  variant = 'default',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-[0.92]',
        variant === 'default' && 'bg-surface text-brand',
        variant === 'glass' && 'text-on-brand bg-white/20 backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      <Icon className="h-5 w-5" strokeWidth={1.5} />
    </button>
  );
}
