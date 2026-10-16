/**
 * Event lifecycle commands (PRD §8.2): console-only, gated by the
 * `event.manage` capability (config/rbac.ts). `event.create` also creates
 * the event's showtimes in one call — the PRD's console flow never splits
 * "create event" from "create showtimes" into separate steps.
 */
import { id } from '@/lib/ids';
import { rangesOverlap } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { applyRefund } from '@/domain/wallet/ledger';
import { notify } from './bookingHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type {
  AgeRating,
  AttendeeCategory,
  EventType,
  EventVenue,
  ProgrammeEvent,
  Showtime,
  ShowtimeCapacityMode,
} from '@/types/event';

export interface EventCreateShowtimeInput {
  start: string;
  end: string;
  regOpens: string;
  regCloses: string;
  capacity: number;
  capacityMode: ShowtimeCapacityMode;
  blockedSeats?: string[];
}

export interface EventCreateInput {
  title: string;
  venue: EventVenue;
  type: EventType;
  poster: string;
  description: string;
  ageRating: AgeRating;
  durationMins: number;
  pricing: Record<AttendeeCategory, number>;
  seasonId?: string;
  showtimes: EventCreateShowtimeInput[];
}

export interface EventPublishInput {
  eventId: string;
}

export interface EventCancelInput {
  eventId: string;
  reason: string;
}

declare module './types' {
  interface CommandRegistry {
    'event.create': { input: EventCreateInput; output: ProgrammeEvent };
    'event.publish': { input: EventPublishInput; output: ProgrammeEvent };
    'event.cancel': { input: EventCancelInput; output: ProgrammeEvent };
  }
}

defineCommand<'event.create'>(
  {
    name: 'event.create',
    run: (ctx, input) => {
      if (input.showtimes.length === 0) {
        return {
          ok: false,
          error: { code: 'NOT_ELIGIBLE', message: 'An event needs at least one showtime.' },
        };
      }

      // PRD §8.2 edge case: "Two showtimes overlap in the same venue at creation: blocked as a conflict" —
      // checked against this event's own new showtimes and every other non-cancelled showtime in the venue.
      const otherVenueShowtimes = Object.values(ctx.state.showtimes).filter((s) => {
        if (s.state === 'cancelled') return false;
        const event = ctx.state.events[s.eventId];
        return event?.venue === input.venue;
      });
      for (let i = 0; i < input.showtimes.length; i += 1) {
        const a = input.showtimes[i]!;
        for (let j = i + 1; j < input.showtimes.length; j += 1) {
          const b = input.showtimes[j]!;
          if (rangesOverlap(a.start, a.end, b.start, b.end)) {
            const rejection = reject(
              'VENUE_CONFLICT',
              'These showtimes overlap each other in the same venue.',
            );
            return { ok: false, error: rejection };
          }
        }
        for (const existing of otherVenueShowtimes) {
          if (rangesOverlap(a.start, a.end, existing.start, existing.end)) {
            const rejection = reject(
              'VENUE_CONFLICT',
              'This showtime overlaps an existing one in the same venue.',
              { start: a.start },
            );
            return { ok: false, error: rejection };
          }
        }
      }

      const eventId = id('evt');
      const event: ProgrammeEvent = {
        id: eventId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        title: input.title,
        venue: input.venue,
        type: input.type,
        poster: input.poster,
        description: input.description,
        ageRating: input.ageRating,
        durationMins: input.durationMins,
        pricing: input.pricing,
        seasonId: input.seasonId,
        lifecycle: 'draft',
      };
      ctx.state.events[eventId] = event;

      for (const s of input.showtimes) {
        const showtimeId = id('show');
        const showtime: Showtime = {
          id: showtimeId,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          eventId,
          start: s.start,
          end: s.end,
          capacityMode: s.capacityMode,
          capacity: s.capacity,
          blockedSeats: s.blockedSeats ?? [],
          regOpens: s.regOpens,
          regCloses: s.regCloses,
          state: 'open',
        };
        ctx.state.showtimes[showtimeId] = showtime;
      }

      return {
        ok: true,
        value: event,
        events: [],
        jobs: [],
        audit: {
          action: 'event.create',
          target: { type: 'event', id: eventId },
          after: { title: input.title, venue: input.venue, showtimes: input.showtimes.length },
        },
      } satisfies CommandResult<ProgrammeEvent>;
    },
  },
  { capability: 'event.manage', resolveAmenity: (input) => input.venue },
);

defineCommand<'event.publish'>(
  {
    name: 'event.publish',
    run: (ctx, input) => {
      const event = ctx.state.events[input.eventId];
      if (!event) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Event not found.' } };
      }
      if (event.lifecycle !== 'draft' && event.lifecycle !== 'scheduled') {
        return {
          ok: false,
          error: {
            code: 'NOT_ELIGIBLE',
            message: 'Only a draft or scheduled event can be published.',
          },
        };
      }
      event.lifecycle = 'published';
      event.publishAt = ctx.now;
      event.updatedAt = ctx.now;

      // Announcement-creation integration deferred (PRD §8.2 mentions it, but no announcement
      // command/UI exists yet in this prototype) — publishing the event is the user-visible effect.

      return {
        ok: true,
        value: event,
        events: [],
        jobs: [],
        audit: { action: 'event.publish', target: { type: 'event', id: event.id } },
      } satisfies CommandResult<ProgrammeEvent>;
    },
  },
  { capability: 'event.manage' },
);

defineCommand<'event.cancel'>(
  {
    name: 'event.cancel',
    run: (ctx, input) => {
      const event = ctx.state.events[input.eventId];
      if (!event) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Event not found.' } };
      }
      if (event.lifecycle === 'cancelled' || event.lifecycle === 'completed') {
        return {
          ok: false,
          error: { code: 'NOT_ELIGIBLE', message: 'Event already cancelled or completed.' },
        };
      }

      event.lifecycle = 'cancelled';
      event.updatedAt = ctx.now;

      const showtimes = Object.values(ctx.state.showtimes).filter((s) => s.eventId === event.id);
      for (const showtime of showtimes) {
        if (showtime.state === 'cancelled' || showtime.state === 'completed') continue;
        showtime.state = 'cancelled';
        showtime.updatedAt = ctx.now;

        for (const rsvp of Object.values(ctx.state.rsvps)) {
          if (rsvp.showtimeId !== showtime.id) continue;
          if (rsvp.state !== 'held' && rsvp.state !== 'confirmed') continue;

          rsvp.state = 'cancelled';
          rsvp.updatedAt = ctx.now;

          const refundFils = rsvp.charges.reduce((sum, c) => sum + c.fils, 0);
          if (refundFils > 0) {
            const { wallet, entry } = applyRefund(ctx.state.wallets[rsvp.unitId], {
              unitId: rsvp.unitId,
              amountFils: refundFils,
              label: 'Event cancelled refund',
              byResidentId: rsvp.bookerId,
              ref: { type: 'rsvp', id: rsvp.id },
              now: ctx.now,
            });
            ctx.state.wallets[rsvp.unitId] = wallet;
            const entryId = id('ledger');
            ctx.state.ledger[entryId] = { id: entryId, ...entry };
          }

          notify(
            ctx,
            rsvp.bookerId,
            'Event cancelled',
            `"${event.title}" was cancelled: ${input.reason}.`,
            'amali://resident/whats-on',
          );
        }

        for (const entry of Object.values(ctx.state.waitlist)) {
          if (entry.resourceKey !== `showtime:${showtime.id}`) continue;
          if (entry.state !== 'waiting' && entry.state !== 'offered') continue;
          entry.state = 'withdrawn';
          entry.updatedAt = ctx.now;
        }
      }

      return {
        ok: true,
        value: event,
        events: [],
        jobs: [],
        audit: {
          action: 'event.cancel',
          target: { type: 'event', id: event.id },
          reason: input.reason,
          after: { showtimesCancelled: showtimes.length },
        },
      } satisfies CommandResult<ProgrammeEvent>;
    },
  },
  { capability: 'event.manage' },
);
