/**
 * Creche bookings (PRD §8.3): book a session (siblings together, each
 * against their own band — a full band waitlists rather than refuses) and
 * cancel. Registration and guardians live in `crecheRegistration.ts`.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addHoursIso, dubaiDateKey, fmtTime, rangesOverlap } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { bandForChild } from '@/domain/creche/bands';
import { countActiveInWindow, isActive } from '@/domain/creche/capacity';
import { validateCrecheBooking } from '@/domain/creche/validate';
import { bandStaff, crecheBands, rebalanceCrecheDate } from './crecheHelpers';
import { defineCommand } from './registry';
import type { CommandCtx, CommandResult } from './types';
import type { AgeBand, Child, CrecheBooking, CrecheSession } from '@/types/creche';

export interface CrecheBookInput {
  childIds: string[];
  /** A morning/afternoon session — or omit and pass `dropIn`. */
  sessionId?: string;
  dropIn?: { start: string; hours: number };
}

export interface CrecheCancelInput {
  bookingId: string;
}

declare module './types' {
  interface CommandRegistry {
    'creche.book': { input: CrecheBookInput; output: CrecheBooking[] };
    'creche.cancel': { input: CrecheCancelInput; output: CrecheBooking };
  }
}

export function actorUnitId(ctx: CommandCtx): string | undefined {
  return ctx.actor.kind === 'resident' ? ctx.state.residents[ctx.actor.id]?.unitId : undefined;
}

function dropInSession(ctx: CommandCtx, start: string, hours: number): CrecheSession {
  const date = dubaiDateKey(start);
  const sessionId = `crsess_${date}_dropin_${fmtTime(start, 'HHmm')}_${hours}h`;
  return (
    ctx.state.crecheSessions[sessionId] ?? {
      id: sessionId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      date,
      start,
      end: addHoursIso(start, hours),
      kind: 'dropin',
    }
  );
}

defineCommand<'creche.book'>({
  name: 'creche.book',
  run: (ctx, input) => {
    const session = input.sessionId
      ? ctx.state.crecheSessions[input.sessionId]
      : input.dropIn
        ? dropInSession(ctx, input.dropIn.start, input.dropIn.hours)
        : undefined;
    if (!session) return { ok: false, error: reject('NO_SESSION', 'Session not found.') };
    if (input.childIds.length === 0) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Choose at least one child.') };
    }

    const all = Object.values(ctx.state.crecheBookings);
    const sessions = { ...ctx.state.crecheSessions, [session.id]: session };
    const added: Partial<Record<AgeBand | 'room', number>> = {};
    const planned: { child: Child; band: AgeBand; state: 'confirmed' | 'waitlisted' }[] = [];

    // Validate every sibling first — a hard rejection for one books none of them.
    for (const childId of input.childIds) {
      const child = ctx.state.children[childId];
      if (!child) return { ok: false, error: reject('NOT_REGISTERED', 'Child not registered.') };
      const band = bandForChild(
        child.dob,
        session.date,
        crecheBands(),
        rules.creche.minAcceptedAge,
      );
      const bandKey = band.ok ? band.band : 'kids';
      const check = validateCrecheBooking({
        now: ctx.now,
        child,
        actorUnitId: actorUnitId(ctx),
        session,
        band,
        childOverlapping: all.filter(
          (b) =>
            b.childId === childId &&
            (isActive(b) || b.state === 'waitlisted') &&
            !!sessions[b.sessionId] &&
            rangesOverlap(
              sessions[b.sessionId]!.start,
              sessions[b.sessionId]!.end,
              session.start,
              session.end,
            ),
        ).length,
        bandCount:
          countActiveInWindow(all, sessions, bandKey, session.start, session.end) +
          (added[bandKey] ?? 0),
        bandCapacity:
          bandStaff(ctx, session.date, bandKey, session.start, session.end).length *
          crecheBands()[bandKey].ratioStaffToChildren,
        roomCount:
          countActiveInWindow(all, sessions, undefined, session.start, session.end) +
          (added.room ?? 0),
        roomCap: rules.creche.roomCapacityAbsolute,
        windowDays: rules.creche.bookingWindowDays,
        leadTimeHours: rules.creche.leadTimeHours,
        dropIn: rules.creche.sessions.dropIn,
      });
      if (!check.ok) return { ok: false, error: check };
      if (check.state === 'confirmed') {
        added[check.band] = (added[check.band] ?? 0) + 1;
        added.room = (added.room ?? 0) + 1;
      }
      planned.push({ child, band: check.band, state: check.state });
    }

    ctx.state.crecheSessions[session.id] ??= session;
    const bookings = planned.map(({ child, band, state }) => {
      const booking: CrecheBooking = {
        id: id('crbk'),
        createdAt: ctx.now,
        updatedAt: ctx.now,
        sessionId: session.id,
        childId: child.id,
        bookedBy: ctx.actor.id,
        band,
        state,
      };
      ctx.state.crecheBookings[booking.id] = booking;
      return booking;
    });

    return {
      ok: true,
      value: bookings,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.book',
        target: { type: 'crecheSession', id: session.id },
        after: {
          bookings: bookings.map((b) => ({ id: b.id, childId: b.childId, state: b.state })),
        },
      },
    } satisfies CommandResult<CrecheBooking[]>;
  },
});

defineCommand<'creche.cancel'>({
  name: 'creche.cancel',
  run: (ctx, input) => {
    const booking = ctx.state.crecheBookings[input.bookingId];
    if (!booking || (booking.state !== 'confirmed' && booking.state !== 'waitlisted')) {
      return {
        ok: false,
        error: reject('NOT_ELIGIBLE', 'This booking can no longer be cancelled.'),
      };
    }
    const child = ctx.state.children[booking.childId];
    if (ctx.actor.kind === 'resident' && actorUnitId(ctx) !== child?.unitId) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Not your booking.') };
    }
    booking.state = 'cancelled';
    booking.updatedAt = ctx.now;
    const session = ctx.state.crecheSessions[booking.sessionId];
    if (session) rebalanceCrecheDate(ctx, session.date);

    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [],
      audit: { action: 'creche.cancel', target: { type: 'crecheBooking', id: booking.id } },
    } satisfies CommandResult<CrecheBooking>;
  },
});
