/**
 * Showtime capacity (PRD §8.2): every attendee category counts toward
 * capacity, including the free ones (resident/household). Pure.
 */
import type { Rsvp } from '@/types/event';

const COUNTING_STATES: readonly Rsvp['state'][] = ['held', 'confirmed'];

export function rsvpsForShowtime(rsvps: readonly Rsvp[], showtimeId: string): Rsvp[] {
  return rsvps.filter((r) => r.showtimeId === showtimeId);
}

/** Attendees across every held/confirmed RSVP for this showtime — what actually occupies capacity. */
export function occupiedAttendeeCount(
  showtimeRsvps: readonly Rsvp[],
  excludeRsvpId?: string,
): number {
  return showtimeRsvps
    .filter((r) => COUNTING_STATES.includes(r.state) && r.id !== excludeRsvpId)
    .reduce((sum, r) => sum + r.attendees.length, 0);
}

/** Confirmed-only occupancy — used to tell SHOWTIME_FULL (truly full) from SHOWTIME_HELD (someone mid-checkout). */
export function confirmedAttendeeCount(showtimeRsvps: readonly Rsvp[]): number {
  return showtimeRsvps
    .filter((r) => r.state === 'confirmed')
    .reduce((sum, r) => sum + r.attendees.length, 0);
}

export function remainingCapacity(
  capacity: number,
  blockedSeats: readonly string[],
  occupied: number,
): number {
  return Math.max(0, capacity - blockedSeats.length - occupied);
}
