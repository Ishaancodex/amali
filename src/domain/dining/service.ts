/**
 * The F&B tablet's read models (PRD §8.4): covers per service period
 * (booked, seated, no-show, walk-in), the last 7 days, the covers forecast
 * (reservations plus the average walk-in rate), and each table's live
 * floor-plan state. Pure.
 */
import { addDaysIso, addMinutesIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import type { Reservation, Table } from '@/types/dining';
import type { PeriodWindow } from './periods';

export interface CoverCounts {
  booked: number;
  seated: number;
  noShow: number;
  walkIn: number;
}

function inWindow(r: Reservation, w: PeriodWindow): boolean {
  return r.start >= w.start && r.start < w.end;
}

export function coversFor(reservations: readonly Reservation[], window: PeriodWindow): CoverCounts {
  const counts: CoverCounts = { booked: 0, seated: 0, noShow: 0, walkIn: 0 };
  for (const r of reservations) {
    if (!inWindow(r, window)) continue;
    if (r.walkIn) counts.walkIn += r.partySize;
    else if (['confirmed', 'seated', 'completed', 'no_show'].includes(r.state))
      counts.booked += r.partySize;
    if (r.state === 'seated' || r.state === 'completed') counts.seated += r.partySize;
    if (r.state === 'no_show') counts.noShow += r.partySize;
  }
  return counts;
}

/** Covers actually served (seated or completed, walk-ins included) per Dubai day, oldest first. */
export function coversByDay(
  reservations: readonly Reservation[],
  todayKey: string,
  days: number,
): { dateKey: string; covers: number }[] {
  const today = dubaiDateTimeToIso(todayKey, '12:00');
  return Array.from({ length: days }, (_, i) => {
    const dateKey = dubaiDateKey(addDaysIso(today, i - days));
    const covers = reservations
      .filter(
        (r) =>
          dubaiDateKey(r.start) === dateKey && (r.state === 'seated' || r.state === 'completed'),
      )
      .reduce((s, r) => s + r.partySize, 0);
    return { dateKey, covers };
  });
}

/**
 * Covers forecast for a period: what's booked and still expected, plus the
 * average walk-in covers for the same period over the history given.
 */
export function coversForecast(
  reservations: readonly Reservation[],
  window: PeriodWindow,
  pastWindows: readonly PeriodWindow[],
): number {
  const expected = reservations
    .filter(
      (r) =>
        inWindow(r, window) && !r.walkIn && ['confirmed', 'seated', 'completed'].includes(r.state),
    )
    .reduce((s, r) => s + r.partySize, 0);
  const walkInsToday = coversFor(reservations, window).walkIn;
  if (pastWindows.length === 0) return expected + walkInsToday;
  const avgWalkIn =
    pastWindows.reduce((s, w) => s + coversFor(reservations, w).walkIn, 0) / pastWindows.length;
  return expected + Math.max(walkInsToday, Math.round(avgWalkIn));
}

export type TableState = 'free' | 'soon' | 'seated' | 'bill' | 'turning';

export function tableState(
  table: Table,
  reservations: readonly Reservation[],
  now: string,
  floor: { reservedSoonMinutes: number; turningMinutes: number },
): { state: TableState; reservation?: Reservation } {
  const mine = reservations.filter((r) => r.tableIds.includes(table.id));
  const seated = mine.find((r) => r.state === 'seated');
  if (seated) return { state: seated.billRequestedAt ? 'bill' : 'seated', reservation: seated };
  const turning = mine.find(
    (r) =>
      r.state === 'completed' &&
      r.bill &&
      r.bill.settledAt <= now &&
      now < addMinutesIso(r.bill.settledAt, floor.turningMinutes),
  );
  if (turning) return { state: 'turning', reservation: turning };
  const soon = mine
    .filter(
      (r) =>
        r.state === 'confirmed' &&
        addMinutesIso(r.start, -floor.reservedSoonMinutes) <= now &&
        now < r.end,
    )
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  if (soon) return { state: 'soon', reservation: soon };
  return { state: 'free' };
}
