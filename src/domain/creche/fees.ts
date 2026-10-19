/**
 * Creche fees (PRD §8.3, mock): owners free; tenants pay per hour on
 * actual time, rounded up to the rounding step, charged at check-out.
 * Late pickup: after the session end + grace, a fee per started 15 minutes.
 */
import { minutesBetween } from '@/lib/time';

const LATE_FEE_STEP_MINUTES = 15;

export function sessionFeeFils(
  checkInAt: string,
  checkOutAt: string,
  perHourFils: number,
  roundingMinutes: number,
): number {
  const minutes = Math.max(0, minutesBetween(checkInAt, checkOutAt));
  const billed = Math.ceil(minutes / roundingMinutes) * roundingMinutes;
  return Math.round((billed / 60) * perHourFils);
}

/** Minutes past the grace period (0 while still within it) — drives the board's running timer. */
export function lateMinutes(sessionEnd: string, at: string, graceMinutes: number): number {
  return Math.max(0, minutesBetween(sessionEnd, at) - graceMinutes);
}

export function lateFeeFils(
  sessionEnd: string,
  pickupAt: string,
  graceMinutes: number,
  per15MinFils: number,
): number {
  const late = lateMinutes(sessionEnd, pickupAt, graceMinutes);
  return late <= 0 ? 0 : Math.ceil(late / LATE_FEE_STEP_MINUTES) * per15MinFils;
}
