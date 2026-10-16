/**
 * Event waitlist — by party size (PRD §8.2: "if 2 seats free up and #1
 * needs 4, offer them to the next party that fits, and keep #1 in the
 * queue"). Pure. Reuses `types/booking.ts#WaitlistEntry` (resourceKey here
 * is `'showtime:<showtimeId>'`) — the shape is identical, just a
 * different resource namespace.
 */
import type { WaitlistEntry } from '@/types/booking';

/** The lowest-position waiting entry whose party fits in `availableCapacity` — skipping over ones that don't, without removing them. */
export function findNextFittingParty(
  entries: readonly WaitlistEntry[],
  availableCapacity: number,
): WaitlistEntry | undefined {
  return entries
    .filter((e) => e.state === 'waiting' && e.partySize <= availableCapacity)
    .sort((a, b) => a.position - b.position)[0];
}
