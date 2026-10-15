/**
 * Blackout and suspension-lift (PRD §8.1 ops flow): console-only commands,
 * gated by the `blackout.create` / `suspension.lift` capabilities
 * (config/rbac.ts).
 */
import { id } from '@/lib/ids';
import { validateBooking } from '@/domain/booking/validate';
import { computeBlackoutImpact } from '@/domain/booking/blackoutImpact';
import { findAlternatives } from '@/domain/booking/alternatives';
import { slotEnd, slotsOverlap } from '@/domain/booking/slots';
import { applyRefund } from '@/domain/wallet/ledger';
import { assembleValidateInput, notify } from './bookingHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Blackout, BlackoutHandling } from '@/types/amenity';

export interface BlackoutCreateInput {
  start: string;
  end: string;
  reason: string;
  handling: BlackoutHandling;
  workOrderId?: string;
}

export interface SuspensionLiftInput {
  suspensionId: string;
}

declare module './types' {
  interface CommandRegistry {
    'blackout.create': { input: BlackoutCreateInput; output: Blackout };
    'suspension.lift': { input: SuspensionLiftInput; output: undefined };
  }
}

defineCommand<'blackout.create'>(
  {
    name: 'blackout.create',
    run: (ctx, input) => {
      const blackoutId = id('blackout');
      const blackout: Blackout = {
        id: blackoutId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        amenity: 'padel',
        start: input.start,
        end: input.end,
        reason: input.reason,
        source: 'maintenance',
        handling: input.handling,
        workOrderId: input.workOrderId,
        createdBy: ctx.actor.id,
      };
      ctx.state.blackouts[blackoutId] = blackout;

      const statusId = id('status');
      ctx.state.amenityStatus.push({
        id: statusId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        amenity: 'padel',
        status: 'maintenance',
        reason: input.reason,
        from: input.start,
        to: input.end,
        workOrderId: input.workOrderId,
        setBy: ctx.actor.id,
      });

      const allBookings = Object.values(ctx.state.bookings).filter((b) => b.amenity === 'padel');
      const impact = computeBlackoutImpact(
        input.start,
        input.end,
        allBookings,
        Object.values(ctx.state.waitlist),
      );

      for (const booking of impact.affectedBookings) {
        if (input.handling === 'cancel_priority_rebook') {
          booking.state = 'cancelled_by_ops';
          booking.updatedAt = ctx.now;
          booking.history.push({
            state: 'cancelled_by_ops',
            at: ctx.now,
            by: ctx.actor.id,
            note: input.reason,
          });
          const refundFils = booking.charges.reduce((sum, c) => sum + c.fils, 0);
          if (refundFils > 0) {
            const { wallet, entry } = applyRefund(ctx.state.wallets[booking.unitId], {
              unitId: booking.unitId,
              amountFils: refundFils,
              label: 'Padel blackout refund',
              byResidentId: booking.bookerId,
              ref: { type: 'booking', id: booking.id },
              now: ctx.now,
            });
            ctx.state.wallets[booking.unitId] = wallet;
            const entryId = id('ledger');
            ctx.state.ledger[entryId] = { id: entryId, ...entry };
          }
          notify(
            ctx,
            booking.bookerId,
            'Padel booking cancelled',
            `Your padel booking was cancelled: ${input.reason}. Pick a priority rebook slot — it won't use your weekly quota.`,
            'amali://resident/amenity-detail?key=padel',
          );
        } else {
          // auto_move: nearest same-duration slot outside the blackout; falls back to cancel+refund if none found.
          const durationMinutes =
            (new Date(booking.end).getTime() - new Date(booking.start).getTime()) / 60000;
          const assembled = assembleValidateInput(ctx, {
            bookerId: booking.bookerId,
            start: booking.start,
            durationMinutes,
            players: booking.players,
          });
          const alternative = !('error' in assembled)
            ? findAlternatives(
                booking.start,
                (candidate) =>
                  !slotsOverlap(
                    candidate,
                    slotEnd(candidate, durationMinutes),
                    input.start,
                    input.end,
                  ) && validateBooking({ ...assembled, start: candidate }).ok,
              )[0]
            : undefined;

          if (alternative) {
            booking.start = alternative;
            booking.end = slotEnd(alternative, durationMinutes);
            booking.updatedAt = ctx.now;
            booking.history.push({
              state: booking.state,
              at: ctx.now,
              by: ctx.actor.id,
              note: `Moved from blackout — ${input.reason}`,
            });
            notify(
              ctx,
              booking.bookerId,
              'Padel booking moved',
              `Your padel booking moved to ${alternative} — ${input.reason}.`,
              'amali://resident/amenity-detail?key=padel',
            );
          } else {
            booking.state = 'cancelled_by_ops';
            booking.updatedAt = ctx.now;
            booking.history.push({
              state: 'cancelled_by_ops',
              at: ctx.now,
              by: ctx.actor.id,
              note: `No alternative found — ${input.reason}`,
            });
            notify(
              ctx,
              booking.bookerId,
              'Padel booking cancelled',
              `Your padel booking was cancelled: ${input.reason}.`,
              'amali://resident/amenity-detail?key=padel',
            );
          }
        }
      }

      return {
        ok: true,
        value: blackout,
        events: [],
        jobs: [],
        audit: {
          action: 'blackout.create',
          target: { type: 'blackout', id: blackoutId },
          after: {
            start: input.start,
            end: input.end,
            handling: input.handling,
            affected: impact.affectedBookings.length,
          },
        },
      } satisfies CommandResult<Blackout>;
    },
  },
  { capability: 'blackout.create', resolveAmenity: () => 'padel' },
);

defineCommand<'suspension.lift'>(
  {
    name: 'suspension.lift',
    run: (ctx, input) => {
      const suspension = ctx.state.suspensions[input.suspensionId];
      if (!suspension) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Suspension not found.' } };
      }
      suspension.liftedBy = ctx.actor.id;
      suspension.updatedAt = ctx.now;
      notify(
        ctx,
        suspension.residentId,
        'Padel suspension lifted',
        'Your padel booking suspension has been lifted.',
        'amali://resident/amenity-detail?key=padel',
      );

      return {
        ok: true,
        value: undefined,
        events: [],
        jobs: [],
        audit: { action: 'suspension.lift', target: { type: 'suspension', id: suspension.id } },
      } satisfies CommandResult<undefined>;
    },
  },
  { capability: 'suspension.lift' },
);
