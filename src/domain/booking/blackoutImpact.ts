/**
 * Blackout impact preview (PRD §8.1 step 2: "4 bookings · 7 residents · 3
 * waitlist entries · AED 100 guest fees to refund"). Pure.
 */
import { slotsOverlap, resourceKeyStart } from './slots';
import { rules } from '@/config/rules';
import type { Booking, WaitlistEntry } from '@/types/booking';

const AFFECTED_STATES: readonly Booking['state'][] = ['held', 'confirmed', 'checked_in'];
const AFFECTED_WAITLIST_STATES: readonly WaitlistEntry['state'][] = ['waiting', 'offered'];

export interface BlackoutImpact {
  affectedBookings: Booking[];
  affectedResidentCount: number;
  affectedWaitlistEntries: WaitlistEntry[];
  guestFeesToRefundFils: number;
}

export function computeBlackoutImpact(
  start: string,
  end: string,
  bookings: readonly Booking[],
  waitlist: readonly WaitlistEntry[],
): BlackoutImpact {
  const affectedBookings = bookings.filter(
    (b) => AFFECTED_STATES.includes(b.state) && slotsOverlap(start, end, b.start, b.end),
  );
  const residentIds = new Set<string>();
  let guestFeesToRefundFils = 0;
  for (const b of affectedBookings) {
    residentIds.add(b.bookerId);
    const guests = b.players.filter((p) => p.guestName).length;
    guestFeesToRefundFils += guests * rules.padel.guestFeeFils;
  }

  const affectedWaitlistEntries = waitlist.filter((w) => {
    if (!AFFECTED_WAITLIST_STATES.includes(w.state)) return false;
    const entryStart = resourceKeyStart(w.resourceKey);
    return entryStart >= start && entryStart < end;
  });

  return {
    affectedBookings,
    affectedResidentCount: residentIds.size,
    affectedWaitlistEntries,
    guestFeesToRefundFils,
  };
}
