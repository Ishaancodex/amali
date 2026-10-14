'use client';

/**
 * Reset (↻) — PRD §4.1. Confirms, then restores the seed state and moves
 * the demo clock back to the scenario start time (just the default start
 * time until scenarios exist — Phase P3+). The icon spins 360° (PRD M28).
 */
import { useState } from 'react';
import { motion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import { dur } from '@/design/motion';
import { hydrateFromSeed } from '@/store/bootstrap';

export function ResetButton() {
  const [spinCount, setSpinCount] = useState(0);

  function handleReset() {
    const confirmed = window.confirm(
      'Reset the demo? This restores the seed data and the start time.',
    );
    if (!confirmed) return;
    setSpinCount((n) => n + 1);
    hydrateFromSeed();
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      aria-label="Reset demo"
      title="Reset demo"
      className="border-shell-stage-border bg-shell-stage-raised text-shell-stage-text hover:text-shell-stage-active flex h-9 w-9 items-center justify-center rounded-full border transition-colors active:scale-95"
    >
      <motion.span
        key={spinCount}
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: dur.slower }}
        className="flex"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
      </motion.span>
    </button>
  );
}
