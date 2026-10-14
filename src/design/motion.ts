/**
 * Motion tokens and named variants (PRD §13). Components use these — never
 * inline duration/easing numbers. `demo.motionSpeed` scales every duration
 * through `t()`.
 */
import type { Transition, Variants } from 'motion/react';

export const dur = {
  instant: 0.1,
  fast: 0.16,
  base: 0.24,
  slow: 0.36,
  slower: 0.56,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
} as const;

export const spring = {
  soft: { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const satisfies Transition,
  snappy: { type: 'spring', stiffness: 420, damping: 34 } as const satisfies Transition,
};

export const stagger = {
  list: { each: 0.03, maxItems: 8 },
} as const;

/** Scale a token duration by the presenter's motion-speed setting (1, 0.5 or 0). */
export function t(seconds: number, motionSpeed: 0 | 0.5 | 1 = 1): number {
  return seconds * motionSpeed;
}

// ---------------------------------------------------------------------------
// Named variants (PRD §13.2)
// ---------------------------------------------------------------------------

export const pushScreen: Variants = {
  initial: { x: '100%', opacity: 1 },
  animate: { x: 0, opacity: 1, transition: { duration: dur.slow, ease: ease.standard } },
  exit: { x: '-30%', opacity: 0.9, transition: { duration: dur.slow, ease: ease.standard } },
};

export const popScreen: Variants = {
  initial: { x: '-30%', opacity: 0.9 },
  animate: { x: 0, opacity: 1, transition: { duration: dur.slow, ease: ease.standard } },
  exit: { x: '100%', opacity: 1, transition: { duration: dur.slow, ease: ease.standard } },
};

export const sheet: Variants = {
  initial: { y: '100%' },
  animate: { y: 0, transition: spring.soft },
  exit: { y: '100%', transition: { duration: dur.base, ease: ease.exit } },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.enter } },
  exit: { opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.exit } },
};

export const islandExpand: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: spring.snappy },
  exit: { scale: 0.95, opacity: 0, transition: { duration: dur.fast, ease: ease.exit } },
};

export const bubbleIn: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: spring.snappy },
};

export const shake: Variants = {
  shake: {
    x: [0, -6, 6, -4, 4, 0],
    transition: { duration: 0.32 },
  },
};

export const strike: Variants = {
  initial: { scaleX: 0 },
  animate: { scaleX: 1, transition: { duration: dur.base, ease: ease.standard } },
};

export const listStagger: Variants = {
  animate: {
    transition: { staggerChildren: stagger.list.each },
  },
};

export const roleDeviceEnter: Variants = {
  initial: { scale: 1.04, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { duration: dur.slower, ease: ease.enter } },
  exit: { scale: 0.96, opacity: 0, transition: { duration: dur.base, ease: ease.exit } },
};
