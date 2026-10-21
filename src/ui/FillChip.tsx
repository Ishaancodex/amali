'use client';

/**
 * A selectable chip that fills with bronze from its centre when chosen
 * (PRD M7: clip-path circle, `dur.base`); the previous choice un-fills.
 */
import { motion } from 'motion/react';
import { dur, ease } from '@/design/motion';
import { cn } from '@/lib/cn';

const FILLED = 'circle(75% at 50% 50%)';
const EMPTY = 'circle(0% at 50% 50%)';

export function FillChip({
  selected,
  disabled,
  onClick,
  className,
  label,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'border-border-card relative overflow-hidden rounded-full border text-center disabled:cursor-not-allowed disabled:line-through disabled:opacity-40',
        selected ? 'text-on-brand' : 'text-text-body',
        className,
      )}
    >
      <motion.span
        aria-hidden
        className="bg-brand absolute inset-0"
        initial={false}
        animate={{ clipPath: selected ? FILLED : EMPTY }}
        transition={{ duration: dur.base, ease: ease.standard }}
      />
      <span className="relative">{children}</span>
    </button>
  );
}
