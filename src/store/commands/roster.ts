/**
 * Roster commands (PRD §8.8): create/edit a shift, mark sick leave, and
 * drive creche band capacity from the roster (PRD §8.3) — a sick lifeguard
 * or carer immediately changes coverage/capacity everywhere that reads
 * the roster, since nothing else caches it.
 */
import { id } from '@/lib/ids';
import { fmtTime } from '@/lib/time';
import { effectiveHoursForDate } from '@/domain/booking/hours';
import { findCoverageGaps } from '@/domain/ops/roster';
import { selectCurrentStatus } from '../selectors/amenities';
import { rebalanceCrecheDate } from './crecheHelpers';
import { defineCommand } from './registry';
import type { CommandCtx, CommandResult } from './types';
import type { AgeBand, BandAssignment } from '@/types/creche';
import type { Shift, ShiftState } from '@/types/ops';
import type { AmenityKey } from '@/types/amenity';

export interface RosterUpsertShiftInput {
  shiftId?: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
  amenity?: AmenityKey;
  band?: AgeBand;
}

export interface RosterMarkSickInput {
  shiftId: string;
}

export interface RosterAssignBandInput {
  date: string;
  band: AgeBand;
  staffIds: string[];
}

declare module './types' {
  interface CommandRegistry {
    'roster.upsertShift': { input: RosterUpsertShiftInput; output: Shift };
    'roster.markSick': { input: RosterMarkSickInput; output: Shift };
    'roster.assignBand': { input: RosterAssignBandInput; output: BandAssignment };
  }
}

defineCommand<'roster.upsertShift'>(
  {
    name: 'roster.upsertShift',
    run: (ctx, input) => {
      const shiftId = input.shiftId ?? id('shift');
      const existing = input.shiftId ? ctx.state.shifts[input.shiftId] : undefined;
      const state: ShiftState = existing?.state ?? 'scheduled';
      const shift: Shift = {
        id: shiftId,
        createdAt: existing?.createdAt ?? ctx.now,
        updatedAt: ctx.now,
        staffId: input.staffId,
        date: input.date,
        start: input.start,
        end: input.end,
        amenity: input.amenity,
        band: input.band,
        state,
      };
      ctx.state.shifts[shiftId] = shift;

      return {
        ok: true,
        value: shift,
        events: [],
        jobs: [],
        audit: {
          action: 'roster.upsertShift',
          target: { type: 'shift', id: shiftId },
          after: { staffId: input.staffId, date: input.date },
        },
      } satisfies CommandResult<Shift>;
    },
  },
  { capability: 'roster.edit', resolveAmenity: (input) => input.amenity },
);

const ALERT_RECIPIENT_ROLES = new Set(['amenity_supervisor', 'community_manager']);

/**
 * PRD §8.5: "If the pool is open with no lifeguard on shift → an alert,
 * and a prompt to change the status to Closed." Called after a pool shift
 * stops counting as coverage: any lifeguard gap that the lost shift leaves
 * from `now` to closing — while the pool isn't already closed — goes to
 * the supervisors and community manager. The prompt itself is the Ops
 * home's "Set to Closed" action on the same gap.
 */
function alertLifeguardGap(ctx: CommandCtx, shift: Shift): void {
  if (shift.amenity !== 'pool') return;
  const status = selectCurrentStatus(ctx.state, 'pool', ctx.now);
  if (status !== 'open' && status !== 'limited') return;

  const hours = effectiveHoursForDate(
    ctx.state.hours,
    Object.values(ctx.state.exceptions),
    'pool',
    shift.date,
  );
  if (!hours) return;
  const staffRoleById = new Map(Object.values(ctx.state.staff).map((s) => [s.id, s.role] as const));
  const gaps = findCoverageGaps(
    Object.values(ctx.state.shifts),
    'pool',
    'lifeguard',
    staffRoleById,
    hours.open,
    hours.close,
  ).filter((g) => g.end > ctx.now && g.start < shift.end && g.end > shift.start);
  if (gaps.length === 0) return;

  const firstGap = gaps[0]!;
  const startsNow = firstGap.start <= ctx.now;
  const window = `${fmtTime(startsNow ? ctx.now : firstGap.start)}–${fmtTime(firstGap.end)}`;
  for (const staff of Object.values(ctx.state.staff)) {
    if (!ALERT_RECIPIENT_ROLES.has(staff.role)) continue;
    const notifId = id('notif');
    ctx.state.notifications[notifId] = {
      id: notifId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      recipientId: staff.id,
      at: ctx.now,
      title: startsNow ? 'Pool open with no lifeguard' : 'Lifeguard gap ahead',
      body: `No lifeguard on shift ${window}. Cover the gap or set the pool to Closed.`,
      deepLink: 'amali://console/ops',
      priority: 'high',
      read: false,
    };
  }
}

defineCommand<'roster.markSick'>(
  {
    name: 'roster.markSick',
    run: (ctx, input) => {
      const shift = ctx.state.shifts[input.shiftId];
      if (!shift) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Shift not found.' } };
      }
      shift.state = 'sick';
      shift.updatedAt = ctx.now;
      alertLifeguardGap(ctx, shift);
      // A sick carer lowers their band's capacity at once (PRD §8.3): rebalance that day's sessions.
      if (shift.amenity === 'creche') rebalanceCrecheDate(ctx, shift.date);

      return {
        ok: true,
        value: shift,
        events: [],
        jobs: [],
        audit: { action: 'roster.markSick', target: { type: 'shift', id: shift.id } },
      } satisfies CommandResult<Shift>;
    },
  },
  { capability: 'roster.edit' },
);

defineCommand<'roster.assignBand'>(
  {
    name: 'roster.assignBand',
    run: (ctx, input) => {
      const existingIndex = ctx.state.bandAssignments.findIndex(
        (b) => b.date === input.date && b.band === input.band,
      );
      const assignment: BandAssignment = {
        date: input.date,
        band: input.band,
        staffIds: input.staffIds,
      };
      if (existingIndex >= 0) {
        ctx.state.bandAssignments[existingIndex] = assignment;
      } else {
        ctx.state.bandAssignments.push(assignment);
      }
      rebalanceCrecheDate(ctx, input.date);

      return {
        ok: true,
        value: assignment,
        events: [],
        jobs: [],
        audit: {
          action: 'roster.assignBand',
          target: { type: 'bandAssignment', id: `${input.date}:${input.band}` },
          after: { staffIds: input.staffIds },
        },
      } satisfies CommandResult<BandAssignment>;
    },
  },
  { capability: 'roster.edit', resolveAmenity: () => 'creche' },
);
