/**
 * Padel booking commands (PRD §7, §8.1). `booking.hold` creates the Booking
 * itself in state 'held' — its `createdAt` plus `rules.booking.holdSeconds`
 * is the hold's expiry, so no separate "hold" entity is needed. Capacity
 * locking falls out of `validateBooking` check 7 treating any overlapping
 * 'held'/'confirmed'/'checked_in' booking as a conflict (SLOT_HELD vs
 * SLOT_FULL respectively) — and since `dispatch` runs the whole
 * check-then-write atomically inside one `set()`, there's no window for a
 * second hold to slip in between. `booking.confirm` turns a still-held
 * Booking into a real one.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMillisecondsIso, addMinutesIso, addHoursIso, minutesBetween } from '@/lib/time';
import { validateBookingWithAlternatives } from '@/domain/booking/validate';
import { slotEnd } from '@/domain/booking/slots';
import { activeStrikes, nextStrikeOutcome } from '@/domain/booking/strikes';
import { applyRefund } from '@/domain/wallet/ledger';
import {
  assembleValidateInput,
  notify,
  advanceWaitlistForResource,
  finalizeConfirmedBooking,
} from './bookingHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Job } from '@/scheduler/queue';
import type { Booking, BookingPlayer } from '@/types/booking';

export interface BookingHoldInput {
  start: string;
  durationMinutes: number;
  players: BookingPlayer[];
}

export interface BookingConfirmInput {
  bookingId: string;
}

export interface BookingCancelInput {
  bookingId: string;
  reason?: string;
}

export interface BookingCheckInInput {
  bookingId: string;
}

export interface BookingReleaseExpiredHoldInput {
  bookingId: string;
}

declare module './types' {
  interface CommandRegistry {
    'booking.hold': { input: BookingHoldInput; output: Booking };
    'booking.bookNow': { input: BookingHoldInput; output: Booking };
    'booking.confirm': { input: BookingConfirmInput; output: Booking };
    'booking.cancel': { input: BookingCancelInput; output: Booking };
    'booking.checkIn': { input: BookingCheckInInput; output: Booking };
    'booking.releaseExpiredHold': { input: BookingReleaseExpiredHoldInput; output: undefined };
  }
}

/** Hold and confirm in one step — a convenience for scenario scripts and tests; the real resident UI always goes through `booking.hold` → `booking.confirm` so the hold countdown (PRD §7) is visible. */
defineCommand<'booking.bookNow'>({
  name: 'booking.bookNow',
  run: (ctx, input) => {
    const assembled = assembleValidateInput(ctx, { bookerId: ctx.actor.id, ...input });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };

    const result = validateBookingWithAlternatives(assembled);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.code,
          message: result.message,
          params: result.params,
          alternatives: result.alternatives,
        },
      };
    }

    const bookingId = id('bk');
    const booking: Booking = {
      id: bookingId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      amenity: 'padel',
      unitId: assembled.unit.id,
      bookerId: ctx.actor.id,
      start: input.start,
      end: slotEnd(input.start, input.durationMinutes),
      players: input.players,
      charges: [],
      state: 'held',
      history: [],
      source: 'resident',
      countsTowardQuota: true,
    };
    ctx.state.bookings[bookingId] = booking;
    const noShowJob = finalizeConfirmedBooking(ctx, booking);

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [noShowJob],
      audit: { action: 'booking.bookNow', target: { type: 'booking', id: bookingId } },
    } satisfies CommandResult<Booking>;
  },
});

defineCommand<'booking.hold'>({
  name: 'booking.hold',
  run: (ctx, input) => {
    const assembled = assembleValidateInput(ctx, { bookerId: ctx.actor.id, ...input });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };

    const result = validateBookingWithAlternatives(assembled);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.code,
          message: result.message,
          params: result.params,
          alternatives: result.alternatives,
        },
      };
    }

    const now = ctx.now;
    const expiresAt = addMillisecondsIso(now, rules.booking.holdSeconds * 1000);
    const bookingId = id('bk');
    const booking: Booking = {
      id: bookingId,
      createdAt: now,
      updatedAt: now,
      amenity: 'padel',
      unitId: assembled.unit.id,
      bookerId: ctx.actor.id,
      start: input.start,
      end: slotEnd(input.start, input.durationMinutes),
      players: input.players,
      charges: [],
      state: 'held',
      history: [{ state: 'held', at: now, by: ctx.actor.id }],
      source: 'resident',
      countsTowardQuota: true,
    };
    ctx.state.bookings[bookingId] = booking;

    const job: Job = {
      id: `hold-expire:${bookingId}`,
      type: 'hold.expire',
      runAt: expiresAt,
      payload: { bookingId },
    };

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [job],
      audit: {
        action: 'booking.hold',
        target: { type: 'booking', id: bookingId },
        after: { start: input.start, durationMinutes: input.durationMinutes },
      },
    } satisfies CommandResult<Booking>;
  },
});

defineCommand<'booking.confirm'>({
  name: 'booking.confirm',
  run: (ctx, input) => {
    const booking = ctx.state.bookings[input.bookingId];
    if (!booking || booking.state !== 'held') {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This hold is no longer available.' },
      };
    }
    if (ctx.actor.kind === 'resident' && booking.bookerId !== ctx.actor.id) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Not your booking.' } };
    }

    const durationMinutes = minutesBetween(booking.start, booking.end);
    const assembled = assembleValidateInput(ctx, {
      bookerId: booking.bookerId,
      start: booking.start,
      durationMinutes,
      players: booking.players,
    });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };
    // Exclude this very booking (still 'held') from its own conflict check.
    const result = validateBookingWithAlternatives({
      ...assembled,
      amenityBookings: assembled.amenityBookings.filter((b) => b.id !== booking.id),
    });
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.code,
          message: result.message,
          params: result.params,
          alternatives: result.alternatives,
        },
      };
    }

    const noShowJob = finalizeConfirmedBooking(ctx, booking);

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [noShowJob],
      audit: {
        action: 'booking.confirm',
        target: { type: 'booking', id: booking.id },
        after: { state: 'confirmed' },
      },
    } satisfies CommandResult<Booking>;
  },
});

defineCommand<'booking.cancel'>({
  name: 'booking.cancel',
  run: (ctx, input) => {
    const booking = ctx.state.bookings[input.bookingId];
    if (!booking || (booking.state !== 'confirmed' && booking.state !== 'checked_in')) {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This booking cannot be cancelled.' },
      };
    }
    if (ctx.actor.kind === 'resident' && booking.bookerId !== ctx.actor.id) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Not your booking.' } };
    }

    const now = ctx.now;
    const cutoff = addHoursIso(booking.start, -rules.padel.freeCancellationHoursBefore);
    const onTime = now < cutoff;
    const jobs: Job[] = [];

    if (onTime) {
      booking.state = 'cancelled';
      booking.history.push({ state: 'cancelled', at: now, by: ctx.actor.id, note: input.reason });
      const refundFils = booking.charges.reduce((sum, c) => sum + c.fils, 0);
      if (refundFils > 0) {
        const { wallet, entry } = applyRefund(ctx.state.wallets[booking.unitId], {
          unitId: booking.unitId,
          amountFils: refundFils,
          label: 'Padel guest fee refund',
          byResidentId: booking.bookerId,
          ref: { type: 'booking', id: booking.id },
          now,
        });
        ctx.state.wallets[booking.unitId] = wallet;
        const entryId = id('ledger');
        ctx.state.ledger[entryId] = { id: entryId, ...entry };
      }
    } else {
      booking.state = 'late_cancelled';
      booking.history.push({
        state: 'late_cancelled',
        at: now,
        by: ctx.actor.id,
        note: input.reason,
      });

      const priorStrikes = activeStrikes(
        Object.values(ctx.state.strikes).filter(
          (s) => s.residentId === booking.bookerId && s.amenity === 'padel',
        ),
        now,
      );
      const outcome = nextStrikeOutcome(priorStrikes.length);
      const strikeId = id('strike');
      ctx.state.strikes[strikeId] = {
        id: strikeId,
        createdAt: now,
        updatedAt: now,
        residentId: booking.bookerId,
        unitId: booking.unitId,
        amenity: 'padel',
        kind: 'late_cancel',
        at: now,
        bookingId: booking.id,
      };

      if (outcome.suspends) {
        const suspensionId = id('susp');
        ctx.state.suspensions[suspensionId] = {
          id: suspensionId,
          createdAt: now,
          updatedAt: now,
          residentId: booking.bookerId,
          amenity: 'padel',
          from: now,
          to: addMinutesIso(now, rules.padel.penalty.suspensionDays * 24 * 60),
        };
        notify(
          ctx,
          booking.bookerId,
          'Padel booking suspended',
          `Strike ${outcome.strikeCount} of ${rules.padel.penalty.strikesToSuspend}: padel booking is suspended for ${rules.padel.penalty.suspensionDays} days.`,
          'amali://resident/amenity-detail?key=padel',
        );
      } else if (outcome.warns) {
        notify(
          ctx,
          booking.bookerId,
          'Padel strike warning',
          `Strike ${outcome.strikeCount} of ${rules.padel.penalty.strikesToSuspend}. One more and padel booking will be suspended.`,
          'amali://resident/amenity-detail?key=padel',
        );
      }
    }

    jobs.push(...advanceWaitlistForResource(ctx, booking.start));

    return {
      ok: true,
      value: booking,
      events: [],
      jobs,
      audit: {
        action: 'booking.cancel',
        target: { type: 'booking', id: booking.id },
        after: { state: booking.state },
      },
    } satisfies CommandResult<Booking>;
  },
});

defineCommand<'booking.checkIn'>({
  name: 'booking.checkIn',
  run: (ctx, input) => {
    const booking = ctx.state.bookings[input.bookingId];
    if (!booking || booking.state !== 'confirmed') {
      return {
        ok: false,
        error: { code: 'NOT_ELIGIBLE', message: 'This booking cannot be checked in.' },
      };
    }
    const windowOpen = addMinutesIso(booking.start, -rules.padel.checkIn.opensMinutesBefore);
    const windowClose = addMinutesIso(booking.start, rules.padel.checkIn.closesMinutesAfter);
    if (ctx.now < windowOpen || ctx.now > windowClose) {
      return {
        ok: false,
        error: {
          code: 'OUTSIDE_HOURS',
          message: `Check-in opens ${rules.padel.checkIn.opensMinutesBefore} minutes before start.`,
        },
      };
    }

    booking.state = 'checked_in';
    booking.updatedAt = ctx.now;
    booking.history.push({ state: 'checked_in', at: ctx.now, by: ctx.actor.id });

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [],
      audit: { action: 'booking.checkIn', target: { type: 'booking', id: booking.id } },
    } satisfies CommandResult<Booking>;
  },
});

/** System-only: the `hold.expire` job handler calls this once a held booking's hold window has passed. */
defineCommand<'booking.releaseExpiredHold'>({
  name: 'booking.releaseExpiredHold',
  run: (ctx, input) => {
    const booking = ctx.state.bookings[input.bookingId];
    if (!booking || booking.state !== 'held') {
      return { ok: true, value: undefined, events: [], jobs: [] };
    }
    delete ctx.state.bookings[input.bookingId];

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs: [],
      audit: {
        action: 'booking.releaseExpiredHold',
        target: { type: 'booking', id: input.bookingId },
      },
    } satisfies CommandResult<undefined>;
  },
});
