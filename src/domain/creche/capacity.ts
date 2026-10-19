/**
 * Ratio capacity (PRD §8.3): allowed children per band = staff assigned to
 * that band on the roster × ratio, with an absolute room cap on top. A
 * carer on the band assignment counts unless a creche shift of theirs that
 * overlaps the window is marked sick — so "Grace calls in sick" drops the
 * Kids band the moment the roster changes, with nothing cached.
 */
import { rangesOverlap } from '@/lib/time';
import type { AgeBand, BandAssignment, CrecheBooking, CrecheSession } from '@/types/creche';
import type { Shift } from '@/types/ops';
import type { BandTable } from './bands';

export function staffOnBand(
  assignments: readonly BandAssignment[],
  shifts: readonly Shift[],
  date: string,
  band: AgeBand,
  windowStart: string,
  windowEnd: string,
): string[] {
  const assigned = assignments.find((a) => a.date === date && a.band === band)?.staffIds ?? [];
  return assigned.filter(
    (staffId) =>
      !shifts.some(
        (s) =>
          s.staffId === staffId &&
          s.amenity === 'creche' &&
          s.state === 'sick' &&
          rangesOverlap(s.start, s.end, windowStart, windowEnd),
      ),
  );
}

export function bandCapacity(staffCount: number, band: AgeBand, bands: BandTable): number {
  return staffCount * bands[band].ratioStaffToChildren;
}

/** Bookings that hold a place: booked-and-expected, or already in the room. */
export function isActive(b: CrecheBooking): boolean {
  return b.state === 'confirmed' || b.state === 'checked_in';
}

/** Active bookings in `band` whose session overlaps the window (drop-ins share the room with sessions). */
export function countActiveInWindow(
  bookings: readonly CrecheBooking[],
  sessionsById: Record<string, CrecheSession>,
  band: AgeBand | undefined,
  windowStart: string,
  windowEnd: string,
): number {
  return bookings.filter((b) => {
    if (!isActive(b) || (band && b.band !== band)) return false;
    const session = sessionsById[b.sessionId];
    return !!session && rangesOverlap(session.start, session.end, windowStart, windowEnd);
  }).length;
}

export interface BandLoad {
  band: AgeBand;
  staffIds: string[];
  capacity: number;
  /** Children currently in the room in this band. */
  inRoom: number;
  /** In the room beyond what the staff on duty allow ("Over ratio by 4"). */
  overBy: number;
}

export function bandLoad(
  band: AgeBand,
  staffIds: string[],
  inRoom: number,
  bands: BandTable,
): BandLoad {
  const capacity = bandCapacity(staffIds.length, band, bands);
  return { band, staffIds, capacity, inRoom, overBy: Math.max(0, inRoom - capacity) };
}

export interface RebalancePlan {
  /** Confirmed-but-not-arrived bookings to move to the waitlist (latest booked first). */
  demote: string[];
  /** Waitlisted bookings to confirm (earliest first). */
  promote: string[];
}

/**
 * PRD §8.3 "a carer goes off sick": children already in stay; new bookings
 * for that session beyond the new capacity move to the waitlist. The
 * reverse runs on recovery — cover added, places free up, the waitlist is
 * confirmed in booking order. All inputs are one session × one band.
 */
export function planRebalance(bookings: readonly CrecheBooking[], capacity: number): RebalancePlan {
  const byCreated = [...bookings].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const checkedIn = byCreated.filter((b) => b.state === 'checked_in').length;
  const confirmed = byCreated.filter((b) => b.state === 'confirmed');
  const waitlisted = byCreated.filter((b) => b.state === 'waitlisted');
  const slots = Math.max(0, capacity - checkedIn);

  if (confirmed.length > slots) {
    return {
      demote: confirmed
        .slice(slots)
        .reverse()
        .map((b) => b.id),
      promote: [],
    };
  }
  return {
    demote: [],
    promote: waitlisted.slice(0, slots - confirmed.length).map((b) => b.id),
  };
}
