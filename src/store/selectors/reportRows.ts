/**
 * The report's normalised booking records (PRD §8.10): every bookable
 * amenity's bookings as an interval, an outcome (attended / no-show /
 * cancelled / late-cancelled / upcoming), a unit, a resident and the seats
 * it took — padel bookings, Screening/Music RSVPs, Restaurant reservations
 * and Kids' Club bookings — inside the report's range and towers.
 */
import type { AmenityKey } from '@/types/amenity';
import type { BookingOutcome, Interval } from '@/domain/reports/kpis';
import type { AppState } from '../types';

export type Row = Interval & {
  outcome: BookingOutcome['outcome'];
  unitId: string;
  residentId: string;
  seats: number;
};

export type ReportRows = Partial<Record<AmenityKey, Row[]>>;

export function reportRows(
  s: AppState,
  inRange: (iso: string) => boolean,
  towerOk: (unitId: string) => boolean,
  now: string,
): ReportRows {
  const rows: Partial<Record<AmenityKey, Row[]>> = {};
  const add = (a: AmenityKey, r: Row) => {
    if (inRange(r.start) && towerOk(r.unitId)) (rows[a] ??= []).push(r);
  };
  for (const b of Object.values(s.bookings)) {
    const outcome =
      b.state === 'no_show'
        ? 'no_show'
        : b.state === 'late_cancelled'
          ? 'late_cancelled'
          : b.state === 'cancelled' || b.state === 'cancelled_by_ops'
            ? 'cancelled'
            : b.start > now
              ? 'upcoming'
              : 'attended';
    add('padel', {
      start: b.start,
      end: b.end,
      outcome,
      unitId: b.unitId,
      residentId: b.bookerId,
      seats: 1,
    });
  }
  for (const r of Object.values(s.rsvps)) {
    const st = s.showtimes[r.showtimeId];
    const venue = st ? s.events[st.eventId]?.venue : undefined;
    if (!st || (venue !== 'screening' && venue !== 'music')) continue;
    const allNoShow =
      r.attendees.length > 0 && r.attendees.every((a) => a.attendance === 'no_show');
    const outcome =
      r.state === 'cancelled'
        ? 'cancelled'
        : r.state === 'late_cancelled'
          ? 'late_cancelled'
          : allNoShow
            ? 'no_show'
            : st.start > now
              ? 'upcoming'
              : 'attended';
    add(venue, {
      start: st.start,
      end: st.end,
      outcome,
      unitId: r.unitId,
      residentId: r.bookerId,
      seats: r.attendees.length,
    });
  }
  for (const r of Object.values(s.reservations)) {
    if (r.walkIn || r.venue !== 'restaurant') continue;
    const outcome =
      r.state === 'no_show'
        ? 'no_show'
        : r.state === 'late_cancelled'
          ? 'late_cancelled'
          : r.state === 'cancelled' || r.state === 'declined'
            ? 'cancelled'
            : r.start > now
              ? 'upcoming'
              : 'attended';
    add('dining', {
      start: r.start,
      end: r.end,
      outcome,
      unitId: r.unitId,
      residentId: r.residentId,
      seats: r.partySize,
    });
  }
  for (const b of Object.values(s.crecheBookings)) {
    const session = s.crecheSessions[b.sessionId];
    if (!session) continue;
    const outcome =
      b.state === 'no_show'
        ? 'no_show'
        : b.state === 'cancelled'
          ? 'cancelled'
          : session.start > now
            ? 'upcoming'
            : 'attended';
    add('creche', {
      start: session.start,
      end: session.end,
      outcome,
      unitId: s.children[b.childId]?.unitId ?? '',
      residentId: b.bookedBy,
      seats: 1,
    });
  }
  return rows;
}

/** Bookings that held their place (not cancelled). */
export function bookedRows(rows: ReportRows, a: AmenityKey): Row[] {
  return (rows[a] ?? []).filter((r) => r.outcome !== 'cancelled' && r.outcome !== 'late_cancelled');
}
