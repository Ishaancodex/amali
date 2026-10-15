/**
 * Booking mutations triggered by ops rather than the resident directly:
 * the no-show sweep (`scheduler/jobs/booking.ts`) and priority rebooking
 * after a blackout cancels a booking (PRD §8.1 edge cases, §8.1 step 2b).
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMinutesIso } from '@/lib/time';
import { validateBooking } from '@/domain/booking/validate';
import { slotEnd } from '@/domain/booking/slots';
import { activeStrikes, nextStrikeOutcome } from '@/domain/booking/strikes';
import {
  assembleValidateInput,
  notify,
  advanceWaitlistForResource,
  finalizeConfirmedBooking,
} from './bookingHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Booking } from '@/types/booking';

export interface BookingMarkNoShowInput {
  bookingId: string;
}

export interface BookingPriorityRebookInput {
  originalBookingId: string;
  start: string;
  durationMinutes: number;
}

declare module './types' {
  interface CommandRegistry {
    'booking.markNoShow': { input: BookingMarkNoShowInput; output: undefined };
    'booking.priorityRebook': { input: BookingPriorityRebookInput; output: Booking };
  }
}

defineCommand<'booking.markNoShow'>({
  name: 'booking.markNoShow',
  run: (ctx, input) => {
    const booking = ctx.state.bookings[input.bookingId];
    if (!booking || booking.state !== 'confirmed') {
      return { ok: true, value: undefined, events: [], jobs: [] };
    }

    booking.state = 'no_show';
    booking.updatedAt = ctx.now;
    booking.history.push({ state: 'no_show', at: ctx.now, by: 'system' });

    const priorStrikes = activeStrikes(
      Object.values(ctx.state.strikes).filter(
        (s) => s.residentId === booking.bookerId && s.amenity === 'padel',
      ),
      ctx.now,
    );
    const outcome = nextStrikeOutcome(priorStrikes.length);
    const strikeId = id('strike');
    ctx.state.strikes[strikeId] = {
      id: strikeId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      residentId: booking.bookerId,
      unitId: booking.unitId,
      amenity: 'padel',
      kind: 'no_show',
      at: ctx.now,
      bookingId: booking.id,
    };

    if (outcome.suspends) {
      const suspensionId = id('susp');
      ctx.state.suspensions[suspensionId] = {
        id: suspensionId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        residentId: booking.bookerId,
        amenity: 'padel',
        from: ctx.now,
        to: addMinutesIso(ctx.now, rules.padel.penalty.suspensionDays * 24 * 60),
      };
      notify(
        ctx,
        booking.bookerId,
        'Padel booking suspended',
        `Strike ${outcome.strikeCount} of ${rules.padel.penalty.strikesToSuspend} (no-show): padel booking is suspended for ${rules.padel.penalty.suspensionDays} days.`,
        'amali://resident/amenity-detail?key=padel',
      );
    } else {
      notify(
        ctx,
        booking.bookerId,
        'Missed padel booking',
        outcome.warns
          ? `Strike ${outcome.strikeCount} of ${rules.padel.penalty.strikesToSuspend}. One more and padel booking will be suspended.`
          : 'You were marked as a no-show for your padel booking.',
        'amali://resident/amenity-detail?key=padel',
      );
    }

    const jobs = advanceWaitlistForResource(ctx, booking.start);

    return {
      ok: true,
      value: undefined,
      events: [],
      jobs,
      audit: { action: 'booking.markNoShow', target: { type: 'booking', id: booking.id } },
    } satisfies CommandResult<undefined>;
  },
});

defineCommand<'booking.priorityRebook'>({
  name: 'booking.priorityRebook',
  run: (ctx, input) => {
    const original = ctx.state.bookings[input.originalBookingId];
    if (!original || original.state !== 'cancelled_by_ops') {
      return {
        ok: false,
        error: {
          code: 'NOT_ELIGIBLE',
          message: 'No priority rebook is available for this booking.',
        },
      };
    }
    if (ctx.actor.kind === 'resident' && original.bookerId !== ctx.actor.id) {
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Not your booking.' } };
    }

    const assembled = assembleValidateInput(ctx, {
      bookerId: original.bookerId,
      start: input.start,
      durationMinutes: input.durationMinutes,
      players: original.players,
    });
    if ('error' in assembled)
      return { ok: false, error: { code: 'NOT_ELIGIBLE', message: assembled.error } };

    // PRD §8.1: a priority-rebook slot "doesn't count against their quota" — exempt it from
    // check 8 by validating as if the unit had no other counting bookings.
    const result = validateBooking({ ...assembled, unitBookings: [] });
    if (!result.ok) {
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
      bookerId: original.bookerId,
      start: input.start,
      end: slotEnd(input.start, input.durationMinutes),
      players: original.players,
      charges: [],
      state: 'held',
      history: [],
      source: 'priority_rebook',
      countsTowardQuota: false,
    };
    ctx.state.bookings[bookingId] = booking;
    const noShowJob = finalizeConfirmedBooking(ctx, booking, `Priority rebook of ${original.id}`);

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [noShowJob],
      audit: {
        action: 'booking.priorityRebook',
        target: { type: 'booking', id: bookingId },
        after: { originalBookingId: original.id },
      },
    } satisfies CommandResult<Booking>;
  },
});
