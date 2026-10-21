/** Resident-facing booking read models. Pass the raw `bookings` record (never a derived array). */
import type { Booking } from '@/types/booking';

/** The resident's earliest confirmed / checked-in padel booking that hasn't ended. */
export function selectNextPadelBooking(
  bookings: Record<string, Booking>,
  residentId: string,
  now: string,
): Booking | undefined {
  return Object.values(bookings)
    .filter(
      (b) =>
        b.bookerId === residentId &&
        b.amenity === 'padel' &&
        (b.state === 'confirmed' || b.state === 'checked_in') &&
        b.end > now,
    )
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}
