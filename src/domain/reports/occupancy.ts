/**
 * Modelled headcount for the non-bookable amenities (PRD §8.10 KPI
 * "Occupancy: average headcount ÷ capacity, per hour"). Pool, gym and
 * creche headcounts aren't stored as history — this deterministic model
 * stands in, shaped by the same peak windows the seed history uses (pool
 * weekends 10:00–17:00; gym 06:00–08:00 and 18:00–21:00), with a stable
 * per-hour jitter, and zero while the amenity is closed (the past pool
 * maintenance shows as a dip). Pure.
 */
import type { Rules } from '@/config/rules.schema';

type History = Rules['seedHistory'];

function hourOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2));
}

function inWindow(hour: number, w: { start: string; end: string }): boolean {
  return hour >= hourOf(w.start) && hour < hourOf(w.end);
}

/** A stable 0..1 jitter for (key, day, hour) — no RNG state, so any sample can be taken in any order. */
function jitter(key: string, dayIndex: number, hour: number): number {
  let h = 2166136261;
  const s = `${key}:${dayIndex}:${hour}`;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export type ModelledAmenity = 'pool' | 'gym' | 'creche';

/**
 * Fraction of capacity in use for an hour, given the Dubai weekday (0 = Sunday) and hour,
 * a day index (for jitter) and whether the amenity was open then.
 */
export function modelledFraction(
  amenity: ModelledAmenity,
  weekday: number,
  hour: number,
  dayIndex: number,
  open: boolean,
  history: History,
): number {
  if (!open) return 0;
  const weekend = weekday === 5 || weekday === 6;
  const w = history.peakWindows;
  let base: number;
  if (amenity === 'pool') {
    base = weekend
      ? inWindow(hour, w.poolWeekend)
        ? 0.7
        : 0.25
      : hour >= 16 && hour < 20
        ? 0.35
        : 0.15;
  } else if (amenity === 'gym') {
    base =
      inWindow(hour, w.gymMorning) || inWindow(hour, w.gymEvening)
        ? 0.65
        : hour >= 9 && hour < 17
          ? 0.2
          : 0.1;
  } else {
    base = (hour >= 9 && hour < 12) || (hour >= 15 && hour < 18) ? 0.45 : 0;
  }
  return Math.max(0, Math.min(1, base * (0.8 + jitter(amenity, dayIndex, hour) * 0.4)));
}
