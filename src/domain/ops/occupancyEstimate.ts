/**
 * Deterministic occupancy estimate for Pool/Gym, keyed off the demo clock
 * hour. This is a placeholder until P6 wires the real guard +/- counter
 * (PRD §8.5) — replace `estimateOccupancy` there; everything that reads it
 * (`OccupancyRing`) won't need to change.
 */
import { toDubai } from '@/lib/time';
import type { OccupancyBand } from '@/types/ops';

export interface OccupancyEstimate {
  count: number;
  capacity: number;
  fraction: number;
  band: OccupancyBand;
}

function bandFor(fraction: number): OccupancyBand {
  if (fraction < 0.35) return 'quiet';
  if (fraction < 0.7) return 'moderate';
  return 'busy';
}

/** A smooth two-peak curve (morning + evening) across the day, in [0, 1]. */
function demandCurve(hour: number, minutes: number): number {
  const t = hour + minutes / 60;
  const morning = Math.exp(-((t - 7) ** 2) / 4);
  const evening = Math.exp(-((t - 19) ** 2) / 6);
  const weekend = Math.exp(-((t - 12) ** 2) / 18) * 0.6;
  return Math.max(morning, evening, weekend);
}

export function estimateOccupancy(nowIso: string, capacity: number): OccupancyEstimate {
  const dubai = toDubai(nowIso);
  const fraction = Math.max(
    0.05,
    Math.min(0.95, demandCurve(dubai.getHours(), dubai.getMinutes())),
  );
  const count = Math.round(fraction * capacity);
  return { count, capacity, fraction, band: bandFor(fraction) };
}
