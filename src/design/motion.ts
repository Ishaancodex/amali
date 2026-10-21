/**
 * Motion tokens and named variants (PRD §13). Components use these — never
 * inline duration/easing numbers.
 *
 * The presenter's "Motion speed" (1×, 0.5× slow-mo, 0 off) applies to every
 * token: `setMotionSpeed` is called by the shell, and the tokens below are
 * getters, so a component reads the current speed when it renders and a
 * variant when it animates. Slow-mo doubles each duration and halves each
 * spring's natural frequency (stiffness ÷ 4, damping ÷ 2), which keeps the
 * spring's shape but plays it at half speed. Off makes every animation
 * instant. Reduced motion is handled by `<MotionConfig reducedMotion="user">`.
 */
import { MotionGlobalConfig, type Transition, type Variants } from 'motion/react';

export type MotionSpeed = 0 | 0.5 | 1;

/** Time multiplier: 2 at 0.5×. */
let slow = 1;

export function setMotionSpeed(speed: MotionSpeed): void {
  slow = speed === 0.5 ? 2 : 1;
  MotionGlobalConfig.instantAnimations = speed === 0;
}

const BASE = { instant: 0.1, fast: 0.16, base: 0.24, slow: 0.36, slower: 0.56 } as const;

export const dur = {
  get instant() {
    return BASE.instant * slow;
  },
  get fast() {
    return BASE.fast * slow;
  },
  get base() {
    return BASE.base * slow;
  },
  get slow() {
    return BASE.slow * slow;
  },
  get slower() {
    return BASE.slower * slow;
  },
  /** M10's rejection shake. */
  get shake() {
    return 0.32 * slow;
  },
  /** M9's one-off gold sheen across a new ticket. */
  get sheen() {
    return 0.8 * slow;
  },
};

export const ease = {
  standard: [0.2, 0, 0, 1],
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
} as const;

function springOf(stiffness: number, damping: number, mass = 1): Transition {
  return { type: 'spring', stiffness: stiffness / slow ** 2, damping: damping / slow, mass };
}

export const spring = {
  get soft() {
    return springOf(260, 30);
  },
  get snappy() {
    return springOf(420, 34);
  },
};

export const stagger = {
  get list() {
    return { each: 0.03 * slow, maxItems: 8 };
  },
  /** M22: chart bars grow 20ms apart. */
  get bar() {
    return 0.02 * slow;
  },
  /** M22: heatmap cells fade in diagonally, per step of row + column. */
  get cell() {
    return 0.012 * slow;
  },
};

/** Stagger delay for the `i`th item of a list (PRD: 30ms per item, max 8 staggered). */
export function staggerDelay(i: number): number {
  return Math.min(i, stagger.list.maxItems) * stagger.list.each;
}

// ---------------------------------------------------------------------------
// Named variants (PRD §13.2). Transitions are getters so they follow the speed.
// ---------------------------------------------------------------------------

export const sheet: Variants = {
  initial: { y: '100%' },
  get animate() {
    return { y: 0, transition: spring.soft };
  },
  get exit() {
    return { y: '100%', transition: { duration: dur.base, ease: ease.exit } };
  },
};

export const backdrop: Variants = {
  initial: { opacity: 0 },
  get animate() {
    return { opacity: 0.4, transition: { duration: dur.base, ease: ease.standard } };
  },
  get exit() {
    return { opacity: 0, transition: { duration: dur.base, ease: ease.standard } };
  },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8 },
  get animate() {
    return { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.enter } };
  },
  get exit() {
    return { opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.exit } };
  },
};

export const bubbleIn: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  get animate() {
    return { scale: 1, opacity: 1, transition: spring.snappy };
  },
};

export const shake: Variants = {
  rest: { x: 0 },
  get shake() {
    return { x: [0, -6, 6, -4, 4, 0], transition: { duration: dur.shake } };
  },
};

export const strike: Variants = {
  initial: { scaleX: 0 },
  get animate() {
    return { scaleX: 1, transition: { duration: dur.base, ease: ease.standard } };
  },
};

export const roleDeviceEnter: Variants = {
  initial: { scale: 1.04, opacity: 0 },
  get animate() {
    return { scale: 1, opacity: 1, transition: { duration: dur.slower, ease: ease.enter } };
  },
  get exit() {
    return { scale: 0.96, opacity: 0, transition: { duration: dur.base, ease: ease.exit } };
  },
};

/** M29: the device content dips out and back in while its language and direction flip. */
export function localeFade(opacity: 0 | 1) {
  return {
    opacity,
    transition: { duration: dur.base / 2, ease: opacity ? ease.enter : ease.exit },
  };
}
