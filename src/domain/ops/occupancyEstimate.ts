/**
 * Deterministic occupancy estimate, from the seeded demand curve (PRD
 * §8.5: "Gym: ... simulated: the counter drifts realistically using the
 * seeded hourly curve"). P6 replaced the Pool's half of this placeholder
 * with the real guard +/− counter (`domain/ops/occupancy.ts`) — the Gym
 * stays on this curve, since card-tap counting isn't modelled.
 */
import { toDubai } from '@/lib/time';
import { occupancyBand } from './occupancy';
import type { OccupancyEstimate } from './occupancy';

export type { OccupancyEstimate };

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
  return { count, capacity, fraction, band: occupancyBand(fraction) };
}
