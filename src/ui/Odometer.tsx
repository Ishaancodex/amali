'use client';

/**
 * Rolling number (PRD M12). Each character gets its own vertical roll when
 * it changes, keyed by its value so only the digits that actually changed
 * animate. Respects reduced motion (handled globally via MotionConfig).
 */
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '@/design/motion';

export function Odometer({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex overflow-hidden tabular-nums ${className ?? ''}`}>
      {value.split('').map((char, i) => (
        <span key={i} className="relative inline-grid place-items-center overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={char}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={spring.snappy}
              className="inline-block"
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
