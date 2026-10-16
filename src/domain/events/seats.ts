/**
 * Screening Room seat map (PRD §8.2: "4 rows × 5 seats (A1-D5) and 2
 * accessible spaces"). Pure.
 */
import type { Rsvp } from '@/types/event';

const ROWS = ['A', 'B', 'C', 'D'] as const;
const SEATS_PER_ROW = 5;
const ACCESSIBLE_SEATS = ['AC1', 'AC2'] as const;

export function allSeatIds(): string[] {
  const seats: string[] = [];
  for (const row of ROWS) {
    for (let n = 1; n <= SEATS_PER_ROW; n += 1) seats.push(`${row}${n}`);
  }
  seats.push(...ACCESSIBLE_SEATS);
  return seats;
}

/** Seats held by someone else's in-progress checkout, separate from confirmed ones (for the SHOWTIME_HELD/SEAT_TAKEN split). */
export function heldSeats(showtimeRsvps: readonly Rsvp[], excludeRsvpId?: string): Set<string> {
  const seats = new Set<string>();
  for (const r of showtimeRsvps) {
    if (r.state !== 'held' || r.id === excludeRsvpId) continue;
    for (const a of r.attendees) if (a.seat) seats.add(a.seat);
  }
  return seats;
}

export function confirmedSeats(showtimeRsvps: readonly Rsvp[]): Set<string> {
  const seats = new Set<string>();
  for (const r of showtimeRsvps) {
    if (r.state !== 'confirmed') continue;
    for (const a of r.attendees) if (a.seat) seats.add(a.seat);
  }
  return seats;
}
