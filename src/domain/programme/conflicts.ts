/**
 * Conflict detection on save (PRD §8.6): a series' occurrences against
 * blackouts, other activities in the same venue, and existing bookings —
 * the bookings through the same impact preview a blackout uses — plus
 * the two edge cases: a season's hours that the class falls outside
 * ("flag it, and suggest moving the class time") and public holidays
 * ("Skip" or "Keep"). Pure.
 */
import { addMinutesIso, dubaiDateKey, dubaiDateTimeToIso, rangesOverlap } from '@/lib/time';
import { computeBlackoutImpact, type BlackoutImpact } from '@/domain/booking/blackoutImpact';
import type { Blackout } from '@/types/amenity';
import type { Booking, WaitlistEntry } from '@/types/booking';
import type { ProgrammeEffect } from '@/types/programme';
import type { Occurrence } from './recurrence';

export interface TimedThing {
  title: string;
  start: string;
  end: string;
}

export interface HoursConflict {
  occurrence: Occurrence;
  open: string;
  close: string;
  /** A start that fits the day's hours, when one exists. */
  suggestedStart?: string;
}

export interface HolidayHit {
  occurrence: Occurrence;
  date: string;
  name: string;
  decision?: 'skip' | 'keep';
}

export interface ProgrammeConflicts {
  blackouts: { occurrence: Occurrence; with: Blackout }[];
  activities: { occurrence: Occurrence; with: TimedThing }[];
  bookings: BlackoutImpact;
  hours: HoursConflict[];
  holidays: HolidayHit[];
}

export interface ConflictInput {
  occurrences: Occurrence[];
  effect: ProgrammeEffect;
  durationMins: number;
  /** Blackouts on this amenity that aren't this series' own. */
  blackouts: readonly Blackout[];
  /** Other activities/showtimes in the same venue (not this series). */
  activities: readonly TimedThing[];
  /** This amenity's bookings (padel) and waitlist — only a blackout displaces them. */
  bookings: readonly Booking[];
  waitlist: readonly WaitlistEntry[];
  /** The amenity's effective hours on a date (seasons included), or undefined when it has none. */
  hoursFor: (dateKey: string) => { open: string; close: string } | undefined;
  holidays: readonly { date: string; name: string }[];
  holidayDecisions: Record<string, 'skip' | 'keep'>;
  suggestionGridMinutes: number;
}

export function findConflicts(input: ConflictInput): ProgrammeConflicts {
  const { occurrences } = input;
  const blackouts = occurrences.flatMap((occurrence) =>
    input.blackouts
      .filter((b) => rangesOverlap(occurrence.start, occurrence.end, b.start, b.end))
      .map((b) => ({ occurrence, with: b })),
  );
  const activities = occurrences.flatMap((occurrence) =>
    input.activities
      .filter((a) => rangesOverlap(occurrence.start, occurrence.end, a.start, a.end))
      .map((a) => ({ occurrence, with: a })),
  );

  // Bookings: the union of what each occurrence would displace, as one blackout-style preview.
  const seen = new Set<string>();
  const seenWaitlist = new Set<string>();
  const merged: BlackoutImpact = {
    affectedBookings: [],
    affectedResidentCount: 0,
    affectedWaitlistEntries: [],
    guestFeesToRefundFils: 0,
  };
  if (input.effect === 'blackout') {
    const residents = new Set<string>();
    for (const o of occurrences) {
      const impact = computeBlackoutImpact(o.start, o.end, input.bookings, input.waitlist);
      for (const b of impact.affectedBookings) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        merged.affectedBookings.push(b);
        residents.add(b.bookerId);
      }
      for (const w of impact.affectedWaitlistEntries) {
        if (seenWaitlist.has(w.id)) continue;
        seenWaitlist.add(w.id);
        merged.affectedWaitlistEntries.push(w);
      }
      merged.guestFeesToRefundFils += impact.guestFeesToRefundFils;
    }
    merged.affectedResidentCount = residents.size;
  }

  const hours: HoursConflict[] = [];
  for (const occurrence of occurrences) {
    const dateKey = dubaiDateKey(occurrence.start);
    const day = input.hoursFor(dateKey);
    if (!day) continue;
    const open = dubaiDateTimeToIso(dateKey, day.open);
    const close = dubaiDateTimeToIso(dateKey, day.close);
    if (occurrence.start >= open && occurrence.end <= close) continue;
    let suggestedStart: string | undefined;
    for (
      let t = open;
      addMinutesIso(t, input.durationMins) <= close;
      t = addMinutesIso(t, input.suggestionGridMinutes)
    ) {
      suggestedStart = t;
      // The nearest fitting start to the class's own time: first one at or after it, else the last before.
      if (t >= occurrence.start) break;
    }
    hours.push({ occurrence, open: day.open, close: day.close, suggestedStart });
  }

  const holidayByDate = new Map(input.holidays.map((h) => [h.date, h.name]));
  const holidays = occurrences
    .filter((o) => holidayByDate.has(dubaiDateKey(o.start)))
    .map((o) => {
      const date = dubaiDateKey(o.start);
      return {
        occurrence: o,
        date,
        name: holidayByDate.get(date)!,
        decision: input.holidayDecisions[date],
      };
    });

  return { blackouts, activities, bookings: merged, hours, holidays };
}

/** Blackouts and activity clashes block a save; bookings, hours and holidays are flagged with options. */
export function blockingConflicts(c: ProgrammeConflicts): number {
  return c.blackouts.length + c.activities.length;
}
