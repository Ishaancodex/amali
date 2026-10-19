/**
 * Roster coverage rules (PRD §8.5 "Staff roster visibility", §8.8
 * "Coverage rules per amenity"): the pool needs ≥1 lifeguard while open;
 * the gym needs an attendant 06–22. Gaps are the sub-intervals of the
 * required window with nobody of that role on shift. Pure.
 */
import type { Shift } from '@/types/ops';
import type { StaffRole } from '@/types/community';
import type { AmenityKey } from '@/types/amenity';

export interface CoverageGap {
  start: string; // ISODateTime
  end: string; // ISODateTime
}

const ACTIVE_SHIFT_STATES: readonly Shift['state'][] = ['scheduled', 'swapped'];

/** The sub-intervals of `[windowStart, windowEnd)` with nobody of `role` on an active shift at that amenity. */
export function findCoverageGaps(
  shifts: readonly Shift[],
  amenity: AmenityKey,
  role: StaffRole,
  staffRoleById: ReadonlyMap<string, StaffRole>,
  windowStart: string,
  windowEnd: string,
): CoverageGap[] {
  const covering = shifts
    .filter(
      (s) =>
        s.amenity === amenity &&
        ACTIVE_SHIFT_STATES.includes(s.state) &&
        staffRoleById.get(s.staffId) === role &&
        s.start < windowEnd &&
        s.end > windowStart,
    )
    .map((s) => ({
      start: s.start < windowStart ? windowStart : s.start,
      end: s.end > windowEnd ? windowEnd : s.end,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));

  // Merge overlapping/adjacent covered intervals.
  const merged: CoverageGap[] = [];
  for (const interval of covering) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = interval.end > last.end ? interval.end : last.end;
    } else {
      merged.push({ ...interval });
    }
  }

  // The gaps are what's left of [windowStart, windowEnd) after removing the merged covered intervals.
  const gaps: CoverageGap[] = [];
  let cursor = windowStart;
  for (const interval of merged) {
    if (interval.start > cursor) gaps.push({ start: cursor, end: interval.start });
    if (interval.end > cursor) cursor = interval.end;
  }
  if (cursor < windowEnd) gaps.push({ start: cursor, end: windowEnd });

  return gaps;
}

/** The gap covering `at`, if any — "the pool is open right now with no lifeguard on shift". */
export function gapAt(gaps: readonly CoverageGap[], at: string): CoverageGap | undefined {
  return gaps.find((g) => g.start <= at && at < g.end);
}
