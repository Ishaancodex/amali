/**
 * The F&B tablet's floor actions (PRD §8.4): move a booking to other tables (the timeline
 * drag), seat, walk-in, mark a no-show (after the grace period — a
 * Teppanyaki/PDR deposit is forfeited; a Restaurant repeat triggers the
 * deposit policy), request the bill and add a note.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMinutesIso, fmtDateTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { periodAt, tableMinutes } from '@/domain/dining/periods';
import { forfeitsDeposit, noShowAllowedFrom, repeatNoShowStatus } from '@/domain/dining/policy';
import { allocateTables, counterSeatsLeft, overlapping } from '@/domain/dining/tables';
import { dubaiDateKey } from '@/lib/time';
import type { Reservation, VenueKey } from '@/types/dining';
import {
  NOT_FNB,
  VENUE_LABEL,
  aed,
  fnbRole,
  forfeitDeposit,
  releaseDeposit,
  tellResident,
} from './diningHelpers';
import { defineCommand } from './registry';
import type { CommandCtx, CommandError, CommandResult } from './types';

export interface DiningRef {
  reservationId: string;
}
export interface DiningMoveInput extends DiningRef {
  tableIds: string[];
}
export interface DiningWalkInInput {
  venue: VenueKey;
  partySize: number;
  tableIds?: string[];
}
export interface DiningNoteInput extends DiningRef {
  note: string;
}

declare module './types' {
  interface CommandRegistry {
    'dining.moveTables': { input: DiningMoveInput; output: Reservation };
    'dining.seat': { input: DiningRef; output: Reservation };
    'dining.walkIn': { input: DiningWalkInInput; output: Reservation };
    'dining.markNoShow': { input: DiningRef; output: Reservation };
    'dining.requestBill': { input: DiningRef; output: Reservation };
    'dining.addNote': { input: DiningNoteInput; output: Reservation };
  }
}

const dining = rules.dining;

type Found = { r: Reservation; error?: undefined } | { r?: undefined; error: CommandError };

function staffReservation(ctx: CommandCtx, reservationId: string): Found {
  if (!fnbRole(ctx)) return { error: NOT_FNB };
  const r = ctx.state.reservations[reservationId];
  return r ? { r } : { error: reject('NOT_ELIGIBLE', 'Reservation not found.') };
}

type Success = Extract<CommandResult<Reservation>, { ok: true }>;

export function ok(r: Reservation, action?: string, after?: unknown): Success {
  return {
    ok: true,
    value: r,
    events: [],
    jobs: [],
    audit: action ? { action, target: { type: 'reservation', id: r.id }, after } : undefined,
  };
}

defineCommand<'dining.moveTables'>({
  name: 'dining.moveTables',
  run: (ctx, input) => {
    const found = staffReservation(ctx, input.reservationId);
    if (found.error) return { ok: false, error: found.error };
    const { r } = found;
    const tables = input.tableIds.map((t) => ctx.state.tables[t]);
    if (tables.some((t) => !t || t.venue !== r.venue)) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'That table isn’t in this venue.') };
    }
    const seats = tables.reduce((s, t) => s + (t?.seats ?? 0), 0);
    if (seats < r.partySize) {
      return {
        ok: false,
        error: reject('GUEST_LIMIT', `Those tables seat ${seats}, the party is ${r.partySize}.`),
      };
    }
    const clash = overlapping(
      Object.values(ctx.state.reservations),
      r.venue,
      r.start,
      r.end,
      r.id,
    ).find((o) => o.tableIds.some((t) => input.tableIds.includes(t)));
    if (clash) {
      return {
        ok: false,
        error: reject(
          'SLOT_FULL',
          `Booked then (${fmtDateTime(clash.start, 'HH:mm')}, ${clash.partySize}).`,
        ),
      };
    }
    const before = r.tableIds;
    r.tableIds = input.tableIds;
    r.updatedAt = ctx.now;
    return {
      ...ok(r),
      audit: {
        action: 'dining.moveTables',
        target: { type: 'reservation', id: r.id },
        before: { tableIds: before },
        after: { tableIds: r.tableIds },
      },
    };
  },
});

defineCommand<'dining.seat'>({
  name: 'dining.seat',
  run: (ctx, input) => {
    const found = staffReservation(ctx, input.reservationId);
    if (found.error) return { ok: false, error: found.error };
    const { r } = found;
    if (r.state !== 'confirmed')
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Only an expected party can be seated.') };
    r.state = 'seated';
    r.seatedAt = ctx.now;
    r.noShowFlaggedAt = undefined;
    r.updatedAt = ctx.now;
    return ok(r, 'dining.seat');
  },
});

defineCommand<'dining.walkIn'>({
  name: 'dining.walkIn',
  run: (ctx, input) => {
    if (!fnbRole(ctx)) return { ok: false, error: NOT_FNB };
    const end = addMinutesIso(ctx.now, tableMinutes(input.venue, input.partySize, dining));
    const reservations = Object.values(ctx.state.reservations);
    let tableIds = input.tableIds;
    if (input.venue === 'teppanyaki') {
      const counter = Object.values(ctx.state.tables).find((t) => t.venue === 'teppanyaki');
      if (
        !counter ||
        counterSeatsLeft(counter.seats, reservations, ctx.now, end) < input.partySize
      ) {
        return { ok: false, error: reject('SLOT_FULL', 'Not enough counter seats free.') };
      }
      tableIds = [counter.id];
    } else if (!tableIds?.length) {
      tableIds = allocateTables({
        tables: Object.values(ctx.state.tables),
        reservations,
        venue: input.venue,
        start: ctx.now,
        end,
        partySize: input.partySize,
      })?.tableIds;
      if (!tableIds)
        return {
          ok: false,
          error: reject('SLOT_FULL', `No table free for ${input.partySize} right now.`),
        };
    }
    const r: Reservation = {
      id: id('res_dine'),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      venue: input.venue,
      residentId: '',
      unitId: '',
      start: ctx.now,
      end,
      period: periodAt(input.venue, dubaiDateKey(ctx.now), ctx.now, dining) ?? 'dinner',
      partySize: input.partySize,
      dietary: [],
      tableIds,
      mode: 'instant',
      state: 'seated',
      seatedAt: ctx.now,
      walkIn: true,
    };
    ctx.state.reservations[r.id] = r;
    return ok(r, 'dining.walkIn', { partySize: r.partySize, tableIds });
  },
});

defineCommand<'dining.markNoShow'>({
  name: 'dining.markNoShow',
  run: (ctx, input) => {
    const found = staffReservation(ctx, input.reservationId);
    if (found.error) return { ok: false, error: found.error };
    const { r } = found;
    if (r.state !== 'confirmed')
      return {
        ok: false,
        error: reject('NOT_ELIGIBLE', 'Only an expected party can be a no-show.'),
      };
    if (ctx.now < noShowAllowedFrom(r.start, dining)) {
      return {
        ok: false,
        error: reject(
          'NOT_ELIGIBLE',
          `Wait out the ${dining.restaurant.noShow.graceMinutes}-minute grace period first.`,
        ),
      };
    }
    r.state = 'no_show';
    r.updatedAt = ctx.now;
    // Teppanyaki/PDR keep the deposit; a Restaurant no-show costs nothing (any held deposit is returned).
    let forfeited = 0;
    if (forfeitsDeposit(r.venue)) forfeited = forfeitDeposit(ctx, r);
    else releaseDeposit(ctx, r);
    let policy: string;
    if (forfeited) {
      policy = `Your ${aed(forfeited)} deposit is kept under the ${VENUE_LABEL[r.venue]} no-show policy.`;
    } else {
      const history = Object.values(ctx.state.reservations).filter(
        (x) => x.residentId === r.residentId,
      );
      const status = repeatNoShowStatus(history, ctx.now, dining);
      const { depositRequiredFils, depositAppliesNextReservations, repeatWindowDays } =
        dining.restaurant.noShow;
      policy = status.required
        ? `That's ${status.noShows} no-shows in ${repeatWindowDays} days, so your next ${depositAppliesNextReservations} Restaurant reservations need a ${aed(depositRequiredFils)} per person deposit.`
        : 'No fee this time. Repeated no-shows mean a deposit is needed on future bookings.';
    }
    tellResident(
      ctx,
      r.residentId,
      'Marked as no-show',
      `${VENUE_LABEL[r.venue]}, ${fmtDateTime(r.start)}. ${policy}`,
    );
    return ok(r, 'dining.markNoShow', { forfeitedFils: forfeited });
  },
});

defineCommand<'dining.requestBill'>({
  name: 'dining.requestBill',
  run: (ctx, input) => {
    const found = staffReservation(ctx, input.reservationId);
    if (found.error) return { ok: false, error: found.error };
    const { r } = found;
    if (r.state !== 'seated')
      return { ok: false, error: reject('NOT_ELIGIBLE', 'The party isn’t seated.') };
    r.billRequestedAt = ctx.now;
    r.updatedAt = ctx.now;
    return ok(r);
  },
});

defineCommand<'dining.addNote'>({
  name: 'dining.addNote',
  run: (ctx, input) => {
    const found = staffReservation(ctx, input.reservationId);
    if (found.error) return { ok: false, error: found.error };
    found.r.notes = input.note.trim() || undefined;
    found.r.updatedAt = ctx.now;
    return ok(found.r);
  },
});
