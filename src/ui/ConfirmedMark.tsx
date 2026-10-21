'use client';

/**
 * Booking confirmed (PRD M9): a circle pops in with `spring.snappy`, the
 * check path draws itself (`pathLength` 0 → 1, `dur.slow`), then the ticket
 * below rises with `spring.soft` and a gold sheen sweeps across it once.
 */
import { motion } from 'motion/react';
import { dur, ease, spring } from '@/design/motion';

export function ConfirmedMark() {
  return (
    <motion.svg
      viewBox="0 0 56 56"
      className="text-success h-14 w-14"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.snappy}
      aria-hidden
    >
      <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <motion.path
        d="M17 29l7 7 15-16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: dur.slow, ease: ease.standard, delay: dur.fast }}
      />
    </motion.svg>
  );
}

/** The ticket card under the mark: rises in, then one sheen pass. */
export function Ticket({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="rounded-tile border-border-card bg-surface relative w-full overflow-hidden border-[0.5px] px-4 py-3"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring.soft, delay: dur.slow }}
    >
      <motion.span
        aria-hidden
        className="bg-brand-tint/70 pointer-events-none absolute inset-y-0 w-10 -skew-x-12"
        initial={{ x: '-120%' }}
        animate={{ x: '420%' }}
        transition={{ duration: dur.sheen, ease: ease.standard, delay: dur.slower }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
