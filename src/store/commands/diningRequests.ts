/**
 * Large-party requests (PRD §8.4 "Approvals"): a Restaurant party of 9+
 * waits for the F&B manager, who accepts (tables allocated, reminders
 * scheduled) or declines (any deposit released), with a message.
 */
import { fmtDateTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { allocateTables } from '@/domain/dining/tables';
import type { Reservation } from '@/types/dining';
import { VENUE_LABEL, fnbRole, releaseDeposit, tellResident } from './diningHelpers';
import { diningJobs } from './diningJobs';
import { ok, type DiningRef } from './diningHost';
import { defineCommand } from './registry';

export interface DiningDecisionInput extends DiningRef {
  message?: string;
}

declare module './types' {
  interface CommandRegistry {
    'dining.approveRequest': { input: DiningDecisionInput; output: Reservation };
    'dining.declineRequest': { input: DiningDecisionInput; output: Reservation };
  }
}

defineCommand<'dining.approveRequest'>({
  name: 'dining.approveRequest',
  run: (ctx, input) => {
    if (fnbRole(ctx) !== 'fnb_manager') {
      return {
        ok: false,
        error: { code: 'NO_PERMISSION', message: 'Large-party requests need the F&B manager.' },
      };
    }
    const r = ctx.state.reservations[input.reservationId];
    if (!r || r.state !== 'requested')
      return { ok: false, error: reject('NOT_ELIGIBLE', 'No pending request.') };
    const allocation = allocateTables({
      tables: Object.values(ctx.state.tables),
      reservations: Object.values(ctx.state.reservations),
      venue: r.venue,
      start: r.start,
      end: r.end,
      partySize: r.partySize,
      zone: r.seatingPref,
    });
    // A party bigger than any pair is still the manager's call — they seat it across tables on the night.
    r.tableIds = allocation?.tableIds ?? [];
    r.state = 'confirmed';
    r.managerMessage = input.message?.trim() || undefined;
    r.updatedAt = ctx.now;
    tellResident(
      ctx,
      r.residentId,
      'Reservation confirmed',
      `${VENUE_LABEL[r.venue]} for ${r.partySize}, ${fmtDateTime(r.start)}.${r.managerMessage ? ` “${r.managerMessage}”` : ''}`,
    );
    return { ...ok(r, 'dining.approveRequest', { tableIds: r.tableIds }), jobs: diningJobs(r) };
  },
});

defineCommand<'dining.declineRequest'>({
  name: 'dining.declineRequest',
  run: (ctx, input) => {
    if (fnbRole(ctx) !== 'fnb_manager') {
      return {
        ok: false,
        error: { code: 'NO_PERMISSION', message: 'Large-party requests need the F&B manager.' },
      };
    }
    const r = ctx.state.reservations[input.reservationId];
    if (!r || r.state !== 'requested')
      return { ok: false, error: reject('NOT_ELIGIBLE', 'No pending request.') };
    r.state = 'declined';
    r.managerMessage = input.message?.trim() || undefined;
    r.updatedAt = ctx.now;
    releaseDeposit(ctx, r);
    tellResident(
      ctx,
      r.residentId,
      'Request declined',
      `${VENUE_LABEL[r.venue]}, ${fmtDateTime(r.start)}.${r.managerMessage ? ` “${r.managerMessage}”` : ''}`,
    );
    return ok(r, 'dining.declineRequest', { message: r.managerMessage });
  },
});
