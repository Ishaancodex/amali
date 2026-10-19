/**
 * Live occupancy (PRD §8.5). The pool's count is the guard's +/− counter
 * (real, stored); the gym's stays the seeded demand curve
 * (`occupancyEstimate.ts`) — both share this module's band thresholds so
 * the two never drift apart. Pure.
 */
import type { OccupancyBand } from '@/types/ops';

export interface OccupancyEstimate {
  count: number;
  capacity: number;
  fraction: number;
  band: OccupancyBand;
}

export function occupancyBand(fraction: number): OccupancyBand {
  if (fraction < 0.35) return 'quiet';
  if (fraction < 0.7) return 'moderate';
  return 'busy';
}

export function buildOccupancyEstimate(count: number, capacity: number): OccupancyEstimate {
  const safeCount = Math.max(0, count);
  const fraction = capacity > 0 ? Math.min(1, safeCount / capacity) : 0;
  return { count: safeCount, capacity, fraction, band: occupancyBand(fraction) };
}

/** The counter can't go below 0 (PRD §8.9) — no upper cap, a guard can overcount briefly. */
export function adjustOccupancy(current: number, delta: number): number {
  return Math.max(0, current + delta);
}
