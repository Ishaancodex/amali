/**
 * Resident dining (PRD §8.4): reserve (deposit held from the wallet; a
 * Restaurant party of 9+ is a request for the manager), cancel (a late
 * one forfeits a Teppanyaki/PDR deposit), "Running late?", the WhatsApp
 * reminder's Confirm, and a party-size change (a cut more than 24h ahead
 * refunds the deposit difference).
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { fmtDateTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { availableFils } from '@/domain/wallet/holds';
import {
  depositFor,
  forfeitsDeposit,
  isLateCancellation,
  repeatNoShowStatus,
} from '@/domain/dining/policy';
import { validateReservation } from '@/domain/dining/validate';
import type { Reservation, TableZone, VenueKey } from '@/types/dining';
import {
  VENUE_LABEL,
  aed,
  forfeitDeposit,
  fnbRole,
  holdDeposit,
  pushResident,
  releaseDeposit,
  tellHosts,
} from './diningHelpers';
import { diningJobs } from './diningJobs';
import { defineCommand } from './registry';
import type { CommandCtx, CommandResult } from './types';

export interface DiningReserveInput {
  venue: VenueKey;
  start: string;
  partySize: number;
  seatingPref?: TableZone;
  occasion?: string;
  dietary?: string[];
  requests?: string;
  highChair?: boolean;
  accessibility?: string;
}
export interface DiningReservationRef {
  reservationId: string;
}
export interface DiningRunningLateInput extends DiningReservationRef {
  minutes: number;
}

declare module './types' {
  interface CommandRegistry {
    'dining.reserve': {
      input: DiningReserveInput;
      output: Reservation & { zoneHonoured: boolean };
    };
    'dining.cancel': { input: DiningReservationRef; output: Reservation };
    'dining.runningLate': { input: DiningRunningLateInput; output: Reservation };
    'dining.confirmAttendance': { input: DiningReservationRef; output: Reservation };
  }
}

const dining = rules.dining;

export function ownReservation(ctx: CommandCtx, reservationId: string): Reservation | undefined {
  const r = ctx.state.reservations[reservationId];
  if (!r) return undefined;
  if (ctx.actor.kind === 'resident') {
    return ctx.state.residents[ctx.actor.id]?.unitId === r.unitId ? r : undefined;
  }
  return fnbRole(ctx) ? r : undefined;
}

export function depositNeeded(
  ctx: CommandCtx,
  residentId: string,
  venue: VenueKey,
  partySize: number,
) {
  const history = Object.values(ctx.state.reservations).filter((r) => r.residentId === residentId);
  return depositFor(
    venue,
    partySize,
    repeatNoShowStatus(history, ctx.now, dining).required,
    dining,
  );
}

defineCommand<'dining.reserve'>({
  name: 'dining.reserve',
  run: (ctx, input) => {
    const resident = ctx.actor.kind === 'resident' ? ctx.state.residents[ctx.actor.id] : undefined;
    if (!resident)
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Only residents can reserve.') };
    const unitId = resident.unitId;
    const deposit = depositNeeded(ctx, resident.id, input.venue, input.partySize);
    if (deposit > 0 && resident.walletRole === 'none') {
      return {
        ok: false,
        error: reject(
          'NOT_ELIGIBLE',
          'This needs a wallet deposit, and your unit’s wallet is with its tenant.',
        ),
      };
    }
    const check = validateReservation({
      now: ctx.now,
      venue: input.venue,
      start: input.start,
      partySize: input.partySize,
      zone: input.seatingPref,
      tables: Object.values(ctx.state.tables),
      reservations: Object.values(ctx.state.reservations),
      depositFils: deposit,
      availableFils: availableFils(
        ctx.state.wallets[unitId],
        Object.values(ctx.state.walletHolds),
        unitId,
      ),
      dining,
    });
    if (!check.ok) return { ok: false, error: check };

    const reservation: Reservation = {
      id: id('res_dine'),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      venue: input.venue,
      residentId: resident.id,
      unitId,
      start: input.start,
      end: check.end,
      period: check.period,
      partySize: input.partySize,
      seatingPref: input.seatingPref,
      occasion: input.occasion,
      dietary: input.dietary ?? [],
      requests: input.requests?.trim() || undefined,
      highChair: input.highChair,
      accessibility: input.accessibility?.trim() || undefined,
      tableIds: check.allocation?.tableIds ?? [],
      mode: check.mode,
      state: check.mode === 'request' ? 'requested' : 'confirmed',
    };
    ctx.state.reservations[reservation.id] = reservation;
    reservation.depositHoldId = holdDeposit(ctx, reservation, deposit);

    const when = fmtDateTime(input.start);
    if (check.mode === 'request') {
      tellHosts(
        ctx,
        'Large-party request',
        `${resident.name} · ${input.partySize} people · ${when}. Accept or decline.`,
        ['fnb_manager'],
        'high',
      );
      pushResident(
        ctx,
        resident.id,
        'Request sent',
        `${VENUE_LABEL[input.venue]} for ${input.partySize}, ${when}. The manager will confirm.`,
      );
    } else {
      pushResident(
        ctx,
        resident.id,
        'Reservation confirmed',
        `${VENUE_LABEL[input.venue]} for ${input.partySize}, ${when}${deposit ? ` · ${aed(deposit)} deposit on hold` : ''}.`,
      );
    }

    return {
      ok: true,
      value: { ...reservation, zoneHonoured: check.allocation?.zoneHonoured ?? true },
      events: [],
      jobs: check.mode === 'instant' ? diningJobs(reservation) : [],
      audit: {
        action: 'dining.reserve',
        target: { type: 'reservation', id: reservation.id },
        after: {
          venue: input.venue,
          partySize: input.partySize,
          mode: check.mode,
          depositFils: deposit,
        },
      },
    } satisfies CommandResult<Reservation & { zoneHonoured: boolean }>;
  },
});

defineCommand<'dining.cancel'>({
  name: 'dining.cancel',
  run: (ctx, input) => {
    const r = ownReservation(ctx, input.reservationId);
    if (!r || (r.state !== 'confirmed' && r.state !== 'requested')) {
      return {
        ok: false,
        error: reject('NOT_ELIGIBLE', 'This reservation can no longer be cancelled.'),
      };
    }
    const late = r.state === 'confirmed' && isLateCancellation(r.venue, r.start, ctx.now, dining);
    r.state = late ? 'late_cancelled' : 'cancelled';
    r.updatedAt = ctx.now;
    const forfeited = late && forfeitsDeposit(r.venue) ? forfeitDeposit(ctx, r) : 0;
    if (!forfeited) releaseDeposit(ctx, r);
    pushResident(
      ctx,
      r.residentId,
      late ? 'Late cancellation' : 'Reservation cancelled',
      forfeited
        ? `Cancelled within ${dining[r.venue].lateCancellationHoursBefore}h, so the ${aed(forfeited)} deposit is kept.`
        : `${VENUE_LABEL[r.venue]}, ${fmtDateTime(r.start)}.`,
    );
    return {
      ok: true,
      value: r,
      events: [],
      jobs: [],
      audit: {
        action: 'dining.cancel',
        target: { type: 'reservation', id: r.id },
        after: { late, forfeitedFils: forfeited },
      },
    } satisfies CommandResult<Reservation>;
  },
});

defineCommand<'dining.runningLate'>({
  name: 'dining.runningLate',
  run: (ctx, input) => {
    const r = ownReservation(ctx, input.reservationId);
    if (!r || r.state !== 'confirmed')
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Reservation not found.') };
    r.runningLateMinutes = input.minutes;
    r.updatedAt = ctx.now;
    tellHosts(
      ctx,
      'Running late',
      `${ctx.state.residents[r.residentId]?.name} (${r.partySize}) is ~${input.minutes} min late for ${fmtDateTime(r.start, 'HH:mm')}.`,
    );
    return { ok: true, value: r, events: [], jobs: [] } satisfies CommandResult<Reservation>;
  },
});

defineCommand<'dining.confirmAttendance'>({
  name: 'dining.confirmAttendance',
  run: (ctx, input) => {
    const r = ownReservation(ctx, input.reservationId);
    if (!r || r.state !== 'confirmed')
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Reservation not found.') };
    return {
      ok: true,
      value: r,
      events: [],
      jobs: [],
      audit: { action: 'dining.confirmAttendance', target: { type: 'reservation', id: r.id } },
    } satisfies CommandResult<Reservation>;
  },
});
