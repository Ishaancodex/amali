/**
 * Shared helpers for the event/RSVP command handlers (events.ts, rsvp.ts,
 * eventWaitlist.ts): assembling `ValidateRsvpInput`, and advancing the
 * event waitlist when a showtime frees capacity (PRD §8.2: "offer them to
 * the next party that fits, and keep #1 in the queue").
 */
import { id } from '@/lib/ids';
import { addMinutesIso } from '@/lib/time';
import {
  occupiedAttendeeCount,
  remainingCapacity,
  rsvpsForShowtime,
} from '@/domain/events/capacity';
import { allSeatIds, confirmedSeats, heldSeats } from '@/domain/events/seats';
import { findNextFittingParty } from '@/domain/events/waitlist';
import { notify } from './bookingHelpers';
import type { ValidateRsvpInput } from '@/domain/events/validate';
import type { CommandCtx } from './types';
import type { Job } from '@/scheduler/queue';

/** The offer window for an event waitlist party — PRD doesn't give events their own number, so this matches padel's sequential offer window for consistency. */
const EVENT_OFFER_MINUTES = 15;

export function showtimeResourceKey(showtimeId: string): string {
  return `showtime:${showtimeId}`;
}

export function assembleValidateRsvpInput(
  ctx: CommandCtx,
  params: { showtimeId: string; attendees: ValidateRsvpInput['attendees']; excludeRsvpId?: string },
): ValidateRsvpInput | { error: string } {
  const showtime = ctx.state.showtimes[params.showtimeId];
  if (!showtime) return { error: 'Showtime not found.' };
  const event = ctx.state.events[showtime.eventId];
  if (!event) return { error: 'Event not found.' };

  return {
    now: ctx.now,
    event,
    showtime,
    attendees: params.attendees,
    showtimeRsvps: rsvpsForShowtime(Object.values(ctx.state.rsvps), params.showtimeId),
    excludeRsvpId: params.excludeRsvpId,
    walletBalanceFils: 0, // the caller fills this in once it knows the unit
  };
}

/** Picks seats for a waitlist-accepted party automatically (PRD doesn't give waitlist acceptors a seat-picker) — first available, in seat-map order. */
export function autoAssignSeats(ctx: CommandCtx, showtimeId: string, count: number): string[] {
  const showtime = ctx.state.showtimes[showtimeId];
  if (!showtime || showtime.capacityMode !== 'seats') return [];
  const rsvps = rsvpsForShowtime(Object.values(ctx.state.rsvps), showtimeId);
  const taken = new Set([...confirmedSeats(rsvps), ...heldSeats(rsvps), ...showtime.blockedSeats]);
  return allSeatIds()
    .filter((s) => !taken.has(s))
    .slice(0, count);
}

/** Offers a freed showtime slot to the next waitlist party that fits — mirrors `bookingHelpers.ts#advanceWaitlistForResource`. */
export function advanceEventWaitlistForShowtime(ctx: CommandCtx, showtimeId: string): Job[] {
  const showtime = ctx.state.showtimes[showtimeId];
  if (!showtime) return [];
  const rsvps = rsvpsForShowtime(Object.values(ctx.state.rsvps), showtimeId);
  const occupied = occupiedAttendeeCount(rsvps);
  const remaining = remainingCapacity(showtime.capacity, showtime.blockedSeats, occupied);
  if (remaining <= 0) return [];

  const key = showtimeResourceKey(showtimeId);
  const waiting = Object.values(ctx.state.waitlist).filter(
    (w) => w.resourceKey === key && w.state === 'waiting',
  );
  const fitting = findNextFittingParty(waiting, remaining);
  if (!fitting) return [];

  const expiresAt = addMinutesIso(ctx.now, EVENT_OFFER_MINUTES);
  fitting.state = 'offered';
  fitting.offer = { sentAt: ctx.now, expiresAt, mode: 'sequential' };
  fitting.updatedAt = ctx.now;

  notify(
    ctx,
    fitting.residentId,
    'Event seats available',
    `Seats for your waitlisted showtime are free — accept within ${EVENT_OFFER_MINUTES} minutes to confirm.`,
    'amali://resident/whats-on',
  );

  return [
    {
      id: `ewl-offer-expire:${fitting.id}:${expiresAt}`,
      type: 'eventWaitlist.offerExpire',
      runAt: expiresAt,
      payload: { waitlistEntryId: fitting.id },
    },
  ];
}

/** Fresh ids for RsvpAttendee rows, since the UI only sends category/name/seat. */
export function withAttendeeIds(attendees: { category: string; name?: string; seat?: string }[]): {
  id: string;
  name: string;
  category: 'resident' | 'household' | 'guest_adult' | 'guest_child';
  seat?: string;
}[] {
  return attendees.map((a) => ({
    id: id('att'),
    name: a.name ?? '',
    category: a.category as 'resident' | 'household' | 'guest_adult' | 'guest_child',
    seat: a.seat,
  }));
}
