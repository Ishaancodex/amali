/**
 * Programme read models (PRD §8.6): a series' occurrences in the forward
 * horizon, and its conflicts against the rest of the state. Shared by the
 * programme commands (to check on save) and the console's live preview
 * (to show the same thing before saving). Fresh objects — call in a
 * component body, not inside a `useStore` selector.
 */
import { rules } from '@/config/rules';
import { addMonthsIso, dubaiDateKey, fmtTime } from '@/lib/time';
import { effectiveHoursForDate } from '@/domain/booking/hours';
import { expandOccurrences, type Occurrence } from '@/domain/programme/recurrence';
import {
  findConflicts,
  type ProgrammeConflicts,
  type TimedThing,
} from '@/domain/programme/conflicts';
import type { AppState } from '../types';
import type { ProgrammeItem } from '@/types/programme';
import type { Season } from '@/types/event';

export type ProgrammeCandidate = Pick<
  ProgrammeItem,
  | 'id'
  | 'title'
  | 'amenity'
  | 'effect'
  | 'rrule'
  | 'dtstart'
  | 'durationMins'
  | 'exdates'
  | 'overrides'
  | 'holidayDecisions'
>;

/** From `now` to the forward horizon (PRD §8.6: "a forward horizon of 12 months"). */
export function programmeHorizon(now: string): { from: string; to: string } {
  return { from: now, to: addMonthsIso(now, rules.programme.forwardHorizonMonths) };
}

export function upcomingOccurrences(item: ProgrammeCandidate, now: string): Occurrence[] {
  const { from, to } = programmeHorizon(now);
  return expandOccurrences(item, item.dtstart > from ? item.dtstart : from, to);
}

/** Everything else in the venue: other series' occurrences and other events' showtimes. */
function otherActivities(s: AppState, item: ProgrammeCandidate, now: string): TimedThing[] {
  const series = Object.values(s.programme)
    .filter((p) => p.id !== item.id && p.amenity === item.amenity && p.state === 'active')
    .flatMap((p) =>
      upcomingOccurrences(p, now).map((o) => ({ title: p.title, start: o.start, end: o.end })),
    );
  const shows = Object.values(s.showtimes)
    .filter(
      (st) =>
        !st.programmeId &&
        st.state !== 'cancelled' &&
        st.end > now &&
        s.events[st.eventId]?.venue === item.amenity,
    )
    .map((st) => ({ title: s.events[st.eventId]?.title ?? 'Event', start: st.start, end: st.end }));
  return [...series, ...shows];
}

export function programmeConflicts(
  s: AppState,
  item: ProgrammeCandidate,
  now: string,
): ProgrammeConflicts {
  const exceptions = Object.values(s.exceptions);
  return findConflicts({
    occurrences: upcomingOccurrences(item, now),
    effect: item.effect,
    durationMins: item.durationMins,
    blackouts: Object.values(s.blackouts).filter(
      (b) => b.amenity === item.amenity && !b.programmeId && b.end > now,
    ),
    activities: otherActivities(s, item, now),
    bookings: Object.values(s.bookings).filter((b) => b.amenity === item.amenity),
    waitlist: Object.values(s.waitlist),
    hoursFor: (dateKey) => {
      const h = effectiveHoursForDate(s.hours, exceptions, item.amenity, dateKey);
      return h ? { open: fmtTime(h.open), close: fmtTime(h.close) } : undefined;
    },
    holidays: rules.programme.publicHolidays,
    holidayDecisions: item.holidayDecisions,
    suggestionGridMinutes: rules.programme.suggestionGridMinutes,
  });
}

/** Seasons as year-view bands (PRD §8.6: "the season appears as a shaded band"). */
export function seasonBands(seasons: Record<string, Season>) {
  return Object.values(seasons)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((season) => ({
      name: season.name,
      from: dubaiDateKey(season.start),
      to: dubaiDateKey(season.end),
      tone: season.tone ?? ('brand' as const),
    }));
}
