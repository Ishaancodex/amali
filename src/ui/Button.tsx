'use client';

/**
 * Button (PRD §5.7). Loading replaces the label with a spinner at a locked
 * width, so the button never changes size when it starts loading.
 */
import { useRef, useState, useLayoutEffect } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-on-brand',
  secondary: 'bg-transparent text-text-title border border-border-card',
  tertiary: 'bg-transparent text-brand',
  destructive: 'bg-transparent text-danger border border-danger',
};

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const contentRef = useRef<HTMLSpanElement>(null);
  const [lockedWidth, setLockedWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (loading && contentRef.current && lockedWidth === null) {
      setLockedWidth(contentRef.current.offsetWidth);
    }
    if (!loading) setLockedWidth(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        'font-wide text-label-3 inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 tracking-widest transition-transform active:scale-[0.98] disabled:opacity-40',
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
      style={lockedWidth ? { width: lockedWidth } : undefined}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        <span ref={contentRef} className="inline-flex items-center gap-2">
          {children}
        </span>
      )}
    </button>
  );
}
