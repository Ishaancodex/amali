/**
 * Padel waitlist commands (PRD §8.1: "Waitlist: per slot, FIFO, max 5
 * people. Each resident can be on at most 2 waitlists at once"). Offers
 * are advanced by `bookingHelpers.ts#advanceWaitlistForResource`, shared
 * with `booking.cancel`/`booking.markNoShow` so a freed slot behaves the
 * same way everywhere it's freed from.
 */
import { id } from '@/lib/ids';
import { addMinutesIso } from '@/lib/time';
import { rules } from '@/config/rules';
import { resourceKey as makeResourceKey, resourceKeyStart, slotEnd } from '@/domain/booking/slots';
import { validateBooking } from '@/domain/booking/validate';
import { assembleValidateInput, notify, advanceWaitlistForResource } from './bookingHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Job } from '@/scheduler/queue';
import type { Booking, WaitlistEntry } from '@/types/booking';

/** Waitlist entries don't carry a duration (PRD §8.1 doesn't ask for one at join time) — accepted offers default to the shorter standard duration. */
const DEFAULT_ACCEPT_DURATION_MINUTES = 60;

export interface WaitlistJoinInput {
  start: string;
  partySize?: number;
}

export interface WaitlistAcceptInput {
  waitlistEntryId: string;
}

export interface WaitlistWithdrawInput {
  waitlistEntryId: string;
}

export interface WaitlistExpireOfferInput {
  waitlistEntryId: string;
}

declare module './types' {
  interface CommandRegistry {
    'waitlist.join': { input: WaitlistJoinInput; output: WaitlistEntry };
    'waitlist.accept': { input: WaitlistAcceptInput; output: Booking };
    'waitlist.withdraw': { input: WaitlistWithdrawInput; output: WaitlistEntry };
    'waitlist.expireOffer': { input: WaitlistExpireOfferInput; output: undefined };
  }
}

defineCommand<'waitlist.join'>({
  name: 'waitlist.join',
  run: (ctx, input) => {
    const key = makeResourceKey('padel', input.start);
    const activeForResident = Object.values(ctx.state.waitlist).filter(
      (w) => w.residentId === ctx.actor.id && (w.state === 'waiting' || w.state === 'offered'),
    );
    if (activeForResident.length >= rules.padel.waitlist.maxActivePerResident) {
      return {
        ok: false,
        error: {
          code: 'WAITLIST_LIMIT',
          message: `You can be on at most ${rules.padel.waitlist.maxActivePerResident} padel waitlists at once.`,
        },
      };
    }
    const waitingForSlot = Object.values(ctx.state.waitlist).filter(
      (w) => w.resourceKey === key && w.state === 'waiting',
    );
    if (waitingForSlot.length >= rules.padel.waitlist.maxPerSlot) {
      return { ok: false, error: { code: 'WAITLIST_FULL', message: 'This waitlist is full.' } };
    }

    const position =
      Object.values(ctx.state.waitlist).filter((w) => w.resourceKey === key).length + 1;
    const entryId = id('wl');
    const entry: WaitlistEntry = {
      id: entryId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      resourceKey: key,
      residentId: ctx.actor.id,
      partySize: input.partySize ?? 1,
      position,
      state: 'waiting',
    };
    ctx.state.waitlist[entryId] = entry;

    return {
      ok: true,
      value: entry,
      events: [],
      jobs: [],
      audit: {
        action: 'waitlist.join',
        target: { type: 'waitlistEntry', id: entryId },
        after: { resourceKey: key, position },
      },
    } satisfies CommandResult<WaitlistEntry>;
  },
});

defineCommand<'waitlist.accept'>({
  name: 'waitlist.accept',
  run: (ctx, input) => {
    const entry = ctx.state.waitlist[input.waitlistEntryId];
    if (!entry || entry.state !== 'offered' || !entry.offer) {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This offer is no longer available.' },
      };
    }
    if (ctx.actor.kind === 'resident' && entry.residentId !== ctx.actor.id) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Not your offer.' } };
    }
    if (entry.offer.expiresAt <= ctx.now) {
      entry.state = 'expired';
      entry.updatedAt = ctx.now;
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Offer expired.' } };
    }

    const start = resourceKeyStart(entry.resourceKey);
    const assembled = assembleValidateInput(ctx, {
      bookerId: entry.residentId,
      start,
      durationMinutes: DEFAULT_ACCEPT_DURATION_MINUTES,
      players: [],
    });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };

    const result = validateBooking({ ...assembled, bypassLeadTime: true });
    if (!result.ok) {
      entry.state = 'expired';
      entry.updatedAt = ctx.now;
      return {
        ok: false,
        error: { code: result.code, message: result.message, params: result.params },
      };
    }

    const bookingId = id('bk');
    const booking: Booking = {
      id: bookingId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      amenity: 'padel',
      unitId: assembled.unit.id,
      bookerId: entry.residentId,
      start,
      end: slotEnd(start, DEFAULT_ACCEPT_DURATION_MINUTES),
      players: [],
      charges: [],
      state: 'confirmed',
      history: [{ state: 'confirmed', at: ctx.now, by: entry.residentId, note: 'From waitlist' }],
      source: 'waitlist',
      countsTowardQuota: true,
    };
    ctx.state.bookings[bookingId] = booking;

    entry.state = 'accepted';
    entry.updatedAt = ctx.now;
    for (const sibling of Object.values(ctx.state.waitlist)) {
      if (
        sibling.id !== entry.id &&
        sibling.resourceKey === entry.resourceKey &&
        sibling.state === 'offered'
      ) {
        sibling.state = 'skipped';
        sibling.updatedAt = ctx.now;
      }
    }

    const noShowJob: Job = {
      id: `noshow:${bookingId}`,
      type: 'booking.noShowSweep',
      runAt: addMinutesIso(start, rules.padel.noShowGraceMinutes),
      payload: { bookingId },
    };

    notify(
      ctx,
      entry.residentId,
      'Padel booking confirmed',
      `Your waitlist offer is confirmed for ${start}.`,
      'amali://resident/amenity-detail?key=padel',
    );

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [noShowJob],
      audit: { action: 'waitlist.accept', target: { type: 'booking', id: bookingId } },
    } satisfies CommandResult<Booking>;
  },
});

defineCommand<'waitlist.withdraw'>({
  name: 'waitlist.withdraw',
  run: (ctx, input) => {
    const entry = ctx.state.waitlist[input.waitlistEntryId];
    if (!entry || (entry.state !== 'waiting' && entry.state !== 'offered')) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Nothing to withdraw.' } };
    }
    entry.state = 'withdrawn';
    entry.updatedAt = ctx.now;
    return {
      ok: true,
      value: entry,
      events: [],
      jobs: [],
      audit: { action: 'waitlist.withdraw', target: { type: 'waitlistEntry', id: entry.id } },
    } satisfies CommandResult<WaitlistEntry>;
  },
});

defineCommand<'waitlist.expireOffer'>({
  name: 'waitlist.expireOffer',
  run: (ctx, input) => {
    const entry = ctx.state.waitlist[input.waitlistEntryId];
    if (!entry || entry.state !== 'offered' || !entry.offer || entry.offer.expiresAt > ctx.now) {
      return { ok: true, value: undefined, events: [], jobs: [] };
    }

    entry.state = 'expired';
    entry.updatedAt = ctx.now;
    notify(
      ctx,
      entry.residentId,
      'Padel offer expired',
      'Your padel waitlist offer expired.',
      'amali://resident/amenity-detail?key=padel',
    );

    const jobs = advanceWaitlistForResource(ctx, resourceKeyStart(entry.resourceKey));

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs,
      audit: { action: 'waitlist.expireOffer', target: { type: 'waitlistEntry', id: entry.id } },
    } satisfies CommandResult<undefined>;
  },
});
