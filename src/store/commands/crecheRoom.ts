/**
 * The playroom floor (PRD §8.3): check-in (with every block, including
 * the severe-allergy acknowledgement), the activity line, and the lead
 * adding cover from the roster. Check-out lives in `crecheCheckOut.ts`.
 * Staff actors aren't `ConsoleRole`s, so these stay ungated at dispatch
 * (same as `occupancy.adjust`) and check the creche role themselves.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { dubaiDateKey, fmtTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { BAND_LABEL, bandForChild } from '@/domain/creche/bands';
import { countActiveInWindow } from '@/domain/creche/capacity';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { validateCheckIn } from '@/domain/creche/validate';
import {
  checkInJobs,
  childFirstName,
  liveBandLoad,
  notifyApp,
  rebalanceCrecheDate,
  sessionRunningAt,
  staffName,
} from './crecheHelpers';
import { defineCommand } from './registry';
import type { CommandCtx, CommandError, CommandResult } from './types';
import type { AgeBand, CrecheBooking } from '@/types/creche';

export interface CrecheCheckInInput {
  childId: string;
  guardianId: string;
  allergyAck?: boolean;
}
export interface CrecheSetActivityInput {
  label: string;
}
export interface CrecheAddCoverInput {
  band: AgeBand;
  staffId: string;
}

declare module './types' {
  interface CommandRegistry {
    'creche.checkIn': { input: CrecheCheckInInput; output: CrecheBooking };
    'creche.setActivity': { input: CrecheSetActivityInput; output: number };
    'creche.addCover': { input: CrecheAddCoverInput; output: string[] };
  }
}

export const NOT_STAFF: CommandError = { code: 'NO_PERMISSION', message: 'Creche staff only.' };

export function crecheRole(ctx: CommandCtx): 'creche_lead' | 'creche_carer' | undefined {
  if (ctx.actor.kind !== 'staff') return undefined;
  const role = ctx.state.staff[ctx.actor.id]?.role;
  return role === 'creche_lead' || role === 'creche_carer' ? role : undefined;
}

defineCommand<'creche.checkIn'>({
  name: 'creche.checkIn',
  run: (ctx, input) => {
    if (!crecheRole(ctx)) return { ok: false, error: NOT_STAFF };
    const child = ctx.state.children[input.childId];
    const session = sessionRunningAt(ctx, ctx.now);
    const all = Object.values(ctx.state.crecheBookings);
    const booking = session
      ? all.find(
          (b) =>
            b.childId === input.childId &&
            b.sessionId === session.id &&
            (b.state === 'confirmed' || b.state === 'waitlisted'),
        )
      : undefined;
    const childBand = child
      ? bandForChild(
          child.dob,
          dubaiDateKey(ctx.now),
          rules.creche.bands,
          rules.creche.minAcceptedAge,
        )
      : undefined;
    if (!booking && childBand && !childBand.ok) {
      return { ok: false, error: reject('AGE_RESTRICTED', childBand.message) };
    }
    const band: AgeBand = booking?.band ?? (childBand?.ok ? childBand.band : 'kids');
    const load = session ? liveBandLoad(ctx, session, band) : undefined;

    const check = validateCheckIn({
      now: ctx.now,
      child,
      guardian: child
        ? guardianAuthorisation(ctx.state.guardians[input.guardianId], child, ctx.now)
        : { ok: true },
      booking,
      session,
      opensMinutesBefore: rules.creche.checkInOpensMinutesBefore,
      band,
      inRoom: load?.inRoom ?? 0,
      capacity: load?.capacity ?? 0,
      roomInRoom: all.filter((b) => b.state === 'checked_in').length,
      roomCap: rules.creche.roomCapacityAbsolute,
      bandBooked: session
        ? countActiveInWindow(all, ctx.state.crecheSessions, band, session.start, session.end)
        : 0,
      allergyAck: !!input.allergyAck,
    });
    if (!check.ok) return { ok: false, error: check };

    // A walk-in with spare capacity becomes a booking on the running session.
    const guardian = ctx.state.guardians[input.guardianId]!;
    const target: CrecheBooking = booking ?? {
      id: id('crbk'),
      createdAt: ctx.now,
      updatedAt: ctx.now,
      sessionId: session!.id,
      childId: child!.id,
      bookedBy: guardian.residentId ?? ctx.state.units[child!.unitId]?.amenityRightsHolderId ?? '',
      band,
      state: 'confirmed',
    };
    target.state = 'checked_in';
    target.updatedAt = ctx.now;
    target.checkIn = {
      at: ctx.now,
      by: ctx.actor.id,
      guardianId: guardian.id,
      allergyAck: child!.allergies?.severe ? true : undefined,
    };
    target.activity = [];
    ctx.state.crecheBookings[target.id] = target;

    notifyApp(
      ctx,
      target.bookedBy,
      `${childFirstName(ctx, target.childId)} checked in`,
      `${childFirstName(ctx, target.childId)} checked in at ${fmtTime(ctx.now)} by ${staffName(ctx, ctx.actor.id)}.`,
    );

    return {
      ok: true,
      value: target,
      events: [],
      jobs: checkInJobs(target, session!),
      audit: {
        action: 'creche.checkIn',
        target: { type: 'crecheBooking', id: target.id },
        after: { guardianId: guardian.id, allergyAck: target.checkIn.allergyAck, walkIn: !booking },
      },
    } satisfies CommandResult<CrecheBooking>;
  },
});

defineCommand<'creche.setActivity'>({
  name: 'creche.setActivity',
  run: (ctx, input) => {
    if (!crecheRole(ctx)) return { ok: false, error: NOT_STAFF };
    const label = input.label.trim();
    if (!label) return { ok: false, error: reject('NOT_ELIGIBLE', 'Enter an activity.') };
    const inRoom = Object.values(ctx.state.crecheBookings).filter((b) => b.state === 'checked_in');
    for (const b of inRoom) {
      (b.activity ??= []).push({ label, at: ctx.now });
      b.updatedAt = ctx.now;
    }
    return { ok: true, value: inRoom.length, events: [], jobs: [] } satisfies CommandResult<number>;
  },
});

defineCommand<'creche.addCover'>({
  name: 'creche.addCover',
  run: (ctx, input) => {
    if (crecheRole(ctx) !== 'creche_lead') {
      return {
        ok: false,
        error: { code: 'NO_PERMISSION', message: 'Only the Creche Lead can move cover.' },
      };
    }
    if (ctx.state.staff[input.staffId]?.assignedAmenities?.includes('creche') !== true) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Not a creche staff member.') };
    }
    const date = dubaiDateKey(ctx.now);
    // One carer, one band: moving cover takes them off any other band today.
    for (const a of ctx.state.bandAssignments) {
      if (a.date === date) a.staffIds = a.staffIds.filter((s) => s !== input.staffId);
    }
    let assignment = ctx.state.bandAssignments.find(
      (a) => a.date === date && a.band === input.band,
    );
    if (!assignment) {
      assignment = { date, band: input.band, staffIds: [] };
      ctx.state.bandAssignments.push(assignment);
    }
    assignment.staffIds.push(input.staffId);
    rebalanceCrecheDate(ctx, date);

    return {
      ok: true,
      value: [...assignment.staffIds],
      events: [],
      jobs: [],
      audit: {
        action: 'creche.addCover',
        target: { type: 'bandAssignment', id: `${date}:${input.band}` },
        after: { staffId: input.staffId, band: BAND_LABEL[input.band] },
      },
    } satisfies CommandResult<string[]>;
  },
});
