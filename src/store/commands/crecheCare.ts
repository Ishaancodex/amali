/**
 * Creche incidents and the day's loose ends (PRD §8.3): log an incident
 * (Medium/High → the parent hears now by app + WhatsApp; Low → at
 * check-out), the parent's acknowledgement, the T−15 pickup reminder, the
 * late-pickup chase, and the end-of-day sweep the lead must resolve.
 * Incidents live in the shared ops `incidents` record (`amenity: 'creche'`)
 * so a Facility one can be converted to a work order from the console.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { fmtTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { childFirstName, notifyApp, notifyParent } from './crecheHelpers';
import { crecheRole } from './crecheRoom';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { CrecheBooking, CrecheIncidentType } from '@/types/creche';
import type { Incident, IncidentSeverity } from '@/types/ops';

export interface CrecheLogIncidentInput {
  /** Optional only for a Facility incident (e.g. a broken toy shelf). */
  childId?: string;
  type: CrecheIncidentType;
  severity: IncidentSeverity;
  description: string;
  witnessId?: string;
  firstAid: boolean;
}
export interface CrecheAcknowledgeIncidentInput {
  incidentId: string;
}
export interface CrecheResolveSweepInput {
  bookingId: string;
  note: string;
}
export interface CrecheBookingJobInput {
  bookingId: string;
}
export interface CrecheSweepInput {
  date: string;
}

declare module './types' {
  interface CommandRegistry {
    'creche.logIncident': { input: CrecheLogIncidentInput; output: Incident };
    'creche.acknowledgeIncident': { input: CrecheAcknowledgeIncidentInput; output: Incident };
    'creche.resolveSweep': { input: CrecheResolveSweepInput; output: CrecheBooking };
    'creche.pickupReminder': { input: CrecheBookingJobInput; output: boolean };
    'creche.latePickup': { input: CrecheBookingJobInput; output: boolean };
    'creche.endOfDaySweep': { input: CrecheSweepInput; output: number };
  }
}

defineCommand<'creche.logIncident'>({
  name: 'creche.logIncident',
  run: (ctx, input) => {
    if (!crecheRole(ctx))
      return { ok: false, error: { code: 'NO_PERMISSION', message: 'Creche staff only.' } };
    if (!input.description.trim()) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Describe what happened.') };
    }
    if (!input.childId && input.type !== 'facility') {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Choose the child involved.') };
    }
    const booking = input.childId
      ? Object.values(ctx.state.crecheBookings).find(
          (b) => b.childId === input.childId && b.state === 'checked_in',
        )
      : undefined;
    const incidentId = id('inc');
    const urgent = input.severity !== 'low';
    const incident: Incident = {
      id: incidentId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      amenity: 'creche',
      category: input.type,
      severity: input.severity,
      description: input.description.trim(),
      raisedBy: ctx.actor.id,
      raisedVia: 'creche',
      at: ctx.now,
      childId: input.childId,
      bookingId: booking?.id,
      witnessId: input.witnessId,
      firstAid: input.firstAid,
      // Low waits for check-out; with no booking open there's no check-out to wait for.
      parentNotifiedAt: urgent || !booking ? ctx.now : undefined,
    };
    ctx.state.incidents[incidentId] = incident;

    const parentId = booking?.bookedBy;
    if (parentId && input.childId && urgent) {
      notifyParent(
        ctx,
        parentId,
        `Incident: ${childFirstName(ctx, input.childId)}`,
        `${incident.description} (${input.severity}, ${fmtTime(ctx.now)}${input.firstAid ? ', first aid given' : ''}). Please acknowledge in the app.`,
      );
    }

    return {
      ok: true,
      value: incident,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.logIncident',
        target: { type: 'incident', id: incidentId },
        after: { childId: input.childId, type: input.type, severity: input.severity },
      },
    } satisfies CommandResult<Incident>;
  },
});

defineCommand<'creche.acknowledgeIncident'>({
  name: 'creche.acknowledgeIncident',
  run: (ctx, input) => {
    const incident = ctx.state.incidents[input.incidentId];
    const child = incident?.childId ? ctx.state.children[incident.childId] : undefined;
    if (!incident || !child || ctx.state.residents[ctx.actor.id]?.unitId !== child.unitId) {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Incident not found.') };
    }
    incident.parentAck ??= { at: ctx.now, by: ctx.actor.id };
    incident.updatedAt = ctx.now;
    return {
      ok: true,
      value: incident,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.acknowledgeIncident',
        target: { type: 'incident', id: incident.id },
      },
    } satisfies CommandResult<Incident>;
  },
});

defineCommand<'creche.resolveSweep'>({
  name: 'creche.resolveSweep',
  run: (ctx, input) => {
    if (crecheRole(ctx) !== 'creche_lead') {
      return {
        ok: false,
        error: { code: 'NO_PERMISSION', message: 'Only the Creche Lead can resolve the sweep.' },
      };
    }
    const booking = ctx.state.crecheBookings[input.bookingId];
    if (!booking || booking.state !== 'checked_in') {
      return { ok: false, error: reject('NOT_ELIGIBLE', 'Already resolved.') };
    }
    booking.state = 'checked_out';
    booking.updatedAt = ctx.now;
    booking.checkOut = { at: ctx.now, by: ctx.actor.id };
    return {
      ok: true,
      value: booking,
      events: [],
      jobs: [],
      audit: {
        action: 'creche.resolveSweep',
        target: { type: 'crecheBooking', id: booking.id },
        reason: input.note.trim() || 'Resolved at end-of-day sweep',
      },
    } satisfies CommandResult<CrecheBooking>;
  },
});

defineCommand<'creche.pickupReminder'>({
  name: 'creche.pickupReminder',
  run: (ctx, input) => {
    const booking = ctx.state.crecheBookings[input.bookingId];
    const session = booking ? ctx.state.crecheSessions[booking.sessionId] : undefined;
    const due = booking?.state === 'checked_in' && !!session;
    if (due) {
      notifyApp(
        ctx,
        booking.bookedBy,
        'Pickup reminder',
        `Please collect ${childFirstName(ctx, booking.childId)} by ${fmtTime(session.end)}.`,
      );
    }
    return { ok: true, value: due, events: [], jobs: [] } satisfies CommandResult<boolean>;
  },
});

defineCommand<'creche.latePickup'>({
  name: 'creche.latePickup',
  run: (ctx, input) => {
    const booking = ctx.state.crecheBookings[input.bookingId];
    const late = booking?.state === 'checked_in';
    if (late) {
      booking.latePickupNotifiedAt = ctx.now;
      booking.updatedAt = ctx.now;
      notifyParent(
        ctx,
        booking.bookedBy,
        'Late pickup',
        `${childFirstName(ctx, booking.childId)} is still in the playroom. A late fee of AED ${rules.creche.latePickup.feePer15MinFils / 100} per 15 minutes now applies.`,
      );
    }
    return { ok: true, value: late, events: [], jobs: [] } satisfies CommandResult<boolean>;
  },
});

defineCommand<'creche.endOfDaySweep'>({
  name: 'creche.endOfDaySweep',
  run: (ctx, input) => {
    const stillIn = Object.values(ctx.state.crecheBookings).filter(
      (b) => b.state === 'checked_in' && ctx.state.crecheSessions[b.sessionId]?.date === input.date,
    );
    for (const b of stillIn) {
      b.flaggedAtSweep = ctx.now;
      b.updatedAt = ctx.now;
    }
    if (stillIn.length > 0) {
      for (const lead of Object.values(ctx.state.staff).filter((s) => s.role === 'creche_lead')) {
        const notifId = id('notif');
        ctx.state.notifications[notifId] = {
          id: notifId,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          recipientId: lead.id,
          at: ctx.now,
          title: 'End-of-day sweep',
          body: `${stillIn.length} ${stillIn.length === 1 ? 'child is' : 'children are'} still checked in. Resolve each one.`,
          deepLink: 'amali://creche/home',
          priority: 'high',
          read: false,
        };
      }
    }
    return {
      ok: true,
      value: stillIn.length,
      events: [],
      jobs: [],
    } satisfies CommandResult<number>;
  },
});
