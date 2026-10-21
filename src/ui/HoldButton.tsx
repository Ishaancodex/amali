'use client';

/**
 * Press-and-hold to confirm: a ring stroke fills over `dur.hold` while the button is held (pointer,
 * or Space/Enter) and drains if released early. Used for SOS, where a pocket tap must not fire.
 */
import { animate, motion, useMotionValue } from 'motion/react';
import { useRef } from 'react';
import { dur } from '@/design/motion';

const SIZE = 160;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;

export function HoldButton({
  label,
  ariaLabel,
  onComplete,
}: {
  label: string;
  ariaLabel: string;
  onComplete: () => void;
}) {
  const progress = useMotionValue(0);
  const running = useRef<ReturnType<typeof animate> | null>(null);

  function start() {
    running.current?.stop();
    running.current = animate(progress, 1, { duration: dur.hold, ease: 'linear', onComplete });
  }

  function stop() {
    running.current?.stop();
    if (progress.get() < 1) animate(progress, 0, { duration: dur.base });
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="relative grid h-40 w-40 touch-none place-items-center rounded-full select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && stop()}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0 -rotate-90 rtl:scale-y-[-1]"
        aria-hidden
        fill="none"
        strokeWidth={STROKE}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} className="stroke-ember-hairline" />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          className="stroke-sand-on-ember"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          style={{ pathLength: progress }}
        />
      </svg>
      <span className="bg-sos font-wide text-on-brand grid h-36 w-36 place-items-center rounded-full text-sm tracking-[0.3em]">
        {label}
      </span>
    </button>
  );
}
