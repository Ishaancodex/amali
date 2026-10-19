/**
 * Water-quality range validation and overdue detection (PRD §8.5). Pure.
 */
import { addHoursIso, addMinutesIso } from '@/lib/time';
import type { Rules } from '@/config/rules.schema';

export interface WaterReadingInput {
  ph: number;
  freeChlorine: number;
  tempC: number;
  clarity: 'pass' | 'fail';
}

/** Which parameters are out of the acceptable range — empty means the reading is clean. */
export function outOfRangeParams(
  reading: WaterReadingInput,
  waterQuality: Rules['pool']['waterQuality'],
): string[] {
  const out: string[] = [];
  if (reading.ph < waterQuality.ph.min || reading.ph > waterQuality.ph.max) out.push('ph');
  if (
    reading.freeChlorine < waterQuality.freeChlorinePpm.min ||
    reading.freeChlorine > waterQuality.freeChlorinePpm.max
  ) {
    out.push('freeChlorine');
  }
  if (reading.tempC < waterQuality.tempC.min || reading.tempC > waterQuality.tempC.max)
    out.push('tempC');
  if (reading.clarity === 'fail') out.push('clarity');
  return out;
}

/**
 * True once more than `overdueMinutes` has passed since the next reading
 * fell due. The next reading is due `intervalHours` after the last one —
 * or, when `openAt` (today's opening time) is later than that, at opening
 * itself: overnight is closed, so yesterday's last reading doesn't make the
 * pool "overdue" at 01:00, but today's first reading is due at 06:00.
 * The caller decides whether the pool is open at `now` at all.
 */
export function isWaterReadingOverdue(
  lastReadingAt: string | undefined,
  now: string,
  intervalHours: number,
  overdueMinutes: number,
  openAt?: string,
): boolean {
  const nextDue = lastReadingAt ? addHoursIso(lastReadingAt, intervalHours) : openAt;
  if (!nextDue) return false; // no reading ever and no opening time to anchor to
  const dueAt = openAt && openAt > nextDue ? openAt : nextDue;
  return now > addMinutesIso(dueAt, overdueMinutes);
}
