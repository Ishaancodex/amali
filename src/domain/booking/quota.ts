/**
 * Padel quota — counted per unit, not per resident (PRD §8.1: "if Layla's
 * spouse booked, Layla sees '2 of 3 used (1 by Khalid)'"). Pure — the
 * caller filters `bookings` down to the unit first.
 */
import { addDaysIso, dubaiDateKey } from '@/lib/time';
import { rules } from '@/config/rules';
import { isPeakStart } from './slots';
import type { Booking } from '@/types/booking';

/** States that count toward quota — a cancelled-on-time booking gives the slot back immediately. */
const QUOTA_STATES: readonly Booking['state'][] = [
  'held',
  'confirmed',
  'checked_in',
  'completed',
  'late_cancelled',
  'no_show',
];

export interface QuotaUsage {
  total: number;
  peak: number;
  byDayCount: Record<string, number>; // DateKey -> count, for the "1 per day" check
}

/** Bookings in `bookings` that count toward quota, within the rolling window ending at `nowIso`. */
export function quotaCountingBookings(bookings: readonly Booking[], nowIso: string): Booking[] {
  const windowStart = addDaysIso(nowIso, -rules.padel.quota.perRollingDays);
  return bookings.filter(
    (b) =>
      b.countsTowardQuota &&
      QUOTA_STATES.includes(b.state) &&
      b.start >= windowStart &&
      b.start <= nowIso,
  );
}

/** Usage for one unit's padel bookings, already filtered to the rolling window. */
export function computeQuotaUsage(unitBookings: readonly Booking[]): QuotaUsage {
  const byDayCount: Record<string, number> = {};
  let peak = 0;
  for (const b of unitBookings) {
    const day = dubaiDateKey(b.start);
    byDayCount[day] = (byDayCount[day] ?? 0) + 1;
    if (isPeakStart(b.start)) peak += 1;
  }
  return { total: unitBookings.length, peak, byDayCount };
}

export function quotaWouldExceed(usage: QuotaUsage, candidateStartIso: string): boolean {
  if (usage.total >= rules.padel.quota.maxBookings) return true;
  const day = dubaiDateKey(candidateStartIso);
  if ((usage.byDayCount[day] ?? 0) >= rules.padel.quota.maxPerDay) return true;
  if (isPeakStart(candidateStartIso) && usage.peak >= rules.padel.quota.maxPeakPerWeek) return true;
  return false;
}
