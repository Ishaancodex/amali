/**
 * Materialising a programme series (PRD §8.6) into the records that carry
 * its effect, inside the forward horizon:
 *
 * - **blackout** → a padel `Blackout` per occurrence (validation and the
 *   slot list already respect blackouts — the clinic simply removes them);
 * - **limited** → a pool "Limited: …" `StatusEntry` for each occurrence's
 *   window;
 * - **event** → a headcount `Showtime` per occurrence on the series' event.
 *
 * Re-running replaces the series' future records. A showtime that still
 * matches an occurrence keeps its id and RSVPs; one whose occurrence is
 * gone is cancelled with its bookings refunded and told. Past records are
 * never touched. Seasons materialise into per-date hours `exceptions`.
 * Mutates `ctx.state` — call inside a `run()` (the seed passes a plain
 * object as the state).
 */
import { rules } from '@/config/rules';
import { addMinutesIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import type { AppState } from '../types';
import type { ProgrammeItem, SeasonHours } from '@/types/programme';
import type { Season } from '@/types/event';
import { upcomingOccurrences } from '../selectors/programme';
import { cancelShowtime } from './events';
import type { CommandCtx } from './types';

const PROGRAMME_ACTOR = 'programme';

function asState(ctx: CommandCtx): AppState {
  return ctx.state as unknown as AppState;
}

export function showtimeIdFor(itemId: string, originalStart: string): string {
  return `pshow_${itemId}_${originalStart}`;
}

/** Creates the series' event (once) so its showtimes have something to belong to. */
function ensureEvent(ctx: CommandCtx, item: ProgrammeItem): string {
  if (item.eventId && ctx.state.events[item.eventId]) return item.eventId;
  // Derived from the series id, so the seed stays deterministic.
  const eventId = `evt_${item.id}`;
  ctx.state.events[eventId] = {
    id: eventId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    title: item.title,
    venue: item.amenity as 'music',
    type: 'class',
    poster: '',
    description: item.note ?? `${item.title} — every week.`,
    ageRating: 'G',
    durationMins: item.durationMins,
    pricing: { resident: 0, household: 0, guest_adult: 0, guest_child: 0 },
    seasonId: item.seasonId,
    lifecycle: 'published',
  };
  item.eventId = eventId;
  return eventId;
}

export interface MaterialiseSummary {
  occurrences: number;
  /** RSVPs cancelled because their class occurrence went away. */
  cancelledBookings: number;
}

export function materialiseProgramme(ctx: CommandCtx, item: ProgrammeItem): MaterialiseSummary {
  const from = ctx.now;
  const occurrences = item.state === 'active' ? upcomingOccurrences(item, ctx.now) : [];
  let cancelledBookings = 0;

  if (item.effect === 'blackout') {
    for (const b of Object.values(ctx.state.blackouts)) {
      if (b.programmeId === item.id && b.start >= from) delete ctx.state.blackouts[b.id];
    }
    for (const o of occurrences) {
      const blackoutId = `pblk_${item.id}_${o.originalStart}`;
      ctx.state.blackouts[blackoutId] = {
        id: blackoutId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        amenity: item.amenity,
        start: o.start,
        end: o.end,
        reason: item.title,
        source: 'programme',
        handling: 'cancel_priority_rebook',
        createdBy: PROGRAMME_ACTOR,
        programmeId: item.id,
      };
    }
  }

  if (item.effect === 'limited') {
    ctx.state.amenityStatus = ctx.state.amenityStatus.filter(
      (e) => !(e.programmeId === item.id && e.from >= from),
    );
    for (const o of occurrences) {
      ctx.state.amenityStatus.push({
        id: `pstat_${item.id}_${o.originalStart}`,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        amenity: item.amenity,
        status: 'limited',
        reason: item.note ? `${item.title} — ${item.note}` : item.title,
        from: o.start,
        to: o.end,
        setBy: PROGRAMME_ACTOR,
        programmeId: item.id,
      });
    }
  }

  if (item.effect === 'event') {
    const eventId = ensureEvent(ctx, item);
    const wanted = new Map(occurrences.map((o) => [showtimeIdFor(item.id, o.originalStart), o]));
    for (const st of Object.values(ctx.state.showtimes)) {
      if (st.programmeId !== item.id || st.start < from || st.state === 'cancelled') continue;
      const o = wanted.get(st.id);
      if (o) {
        st.start = o.start;
        st.end = o.end;
        st.regCloses = o.start;
        st.updatedAt = ctx.now;
        wanted.delete(st.id);
        continue;
      }
      const live = Object.values(ctx.state.rsvps).some(
        (r) => r.showtimeId === st.id && (r.state === 'held' || r.state === 'confirmed'),
      );
      if (live) cancelledBookings += cancelShowtime(ctx, st, item.title, 'the class time changed');
      else delete ctx.state.showtimes[st.id];
    }
    for (const [showtimeId, o] of wanted) {
      ctx.state.showtimes[showtimeId] = {
        id: showtimeId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        eventId,
        start: o.start,
        end: o.end,
        capacityMode: 'headcount',
        capacity: item.capacity ?? rules.music.capacity,
        blockedSeats: [],
        regOpens: ctx.now,
        regCloses: o.start,
        state: 'open',
        programmeId: item.id,
      };
    }
  }

  return { occurrences: occurrences.length, cancelledBookings };
}

/** A season's daily hours as per-date exceptions (replacing any it made before). */
export function materialiseSeason(ctx: CommandCtx, season: Season): number {
  for (const e of Object.values(ctx.state.exceptions)) {
    if (e.seasonId === season.id) delete ctx.state.exceptions[e.id];
  }
  let made = 0;
  const hours: SeasonHours[] = season.hours ?? [];
  if (!hours.length) return made;
  // Walk calendar dates as keys (no time zones involved — a date key is already Dubai-local).
  const last = dubaiDateKey(season.end);
  for (let date = dubaiDateKey(season.start); date <= last; date = nextDateKey(date)) {
    for (const h of hours) {
      const excId = `exc_${season.id}_${h.amenity}_${date}`;
      ctx.state.exceptions[excId] = {
        id: excId,
        amenity: h.amenity,
        date,
        open: h.open,
        close: h.close,
        label: season.name,
        seasonId: season.id,
      };
      made += 1;
    }
  }
  return made;
}

/** The calendar day after a `YYYY-MM-DD` key. */
export function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function seasonRange(startDate: string, endDate: string): { start: string; end: string } {
  return {
    start: dubaiDateTimeToIso(startDate, '00:00'),
    end: addMinutesIso(dubaiDateTimeToIso(endDate, '00:00'), 24 * 60 - 1),
  };
}

export { asState };
