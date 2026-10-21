'use client';

/**
 * Reset demo (PRD M28): the device content fades through the Amali logo
 * splash back to the start screen. Plays each time Reset is confirmed.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { dur, ease } from '@/design/motion';
import { useUiStore } from '@/store/uiStore';

/** How long the logo holds, in multiples of `dur.slower` (≈ 400ms of hold at 1×). */
const HOLD = 0.7;

export function ResetSplash() {
  const resetCount = useUiStore((s) => s.resetCount);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (resetCount === 0) return;
    setShown(resetCount);
    const timer = setTimeout(() => setShown(0), (dur.slower + dur.slower * HOLD) * 1000);
    return () => clearTimeout(timer);
  }, [resetCount]);

  return (
    <AnimatePresence>
      {shown > 0 && (
        <motion.div
          key={shown}
          className="bg-bg-page absolute inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.base, ease: ease.standard }}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/amali-logo-dark.svg" alt="" className="h-8 w-auto" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
