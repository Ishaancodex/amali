/**
 * Incident → work order (PRD §8.5 steps 1-2): raise from any surface,
 * merge a duplicate, or triage into a work order.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMinutesIso } from '@/lib/time';
import { findDuplicateIncident } from '@/domain/ops/incidents';
import { computeSlaDeadlines } from '@/domain/ops/sla';
import { slaCheckJob } from './workOrders';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Incident, Priority, WorkOrder } from '@/types/ops';
import type { AmenityKey } from '@/types/amenity';

export interface IncidentRaiseInput {
  amenity: AmenityKey | 'creche';
  category: string;
  severity: Incident['severity'];
  description: string;
  photo?: string;
  raisedVia: Incident['raisedVia'];
  childId?: string;
}

export interface IncidentMergeInput {
  incidentId: string;
  mergedInto: string;
}

export interface IncidentConvertToWorkOrderInput {
  incidentId: string;
  priority: Priority;
  title: string;
  assignee: WorkOrder['assignee'];
}

declare module './types' {
  interface CommandRegistry {
    'incident.raise': { input: IncidentRaiseInput; output: Incident & { duplicateOf?: string } };
    'incident.merge': { input: IncidentMergeInput; output: Incident };
    'incident.convertToWorkOrder': { input: IncidentConvertToWorkOrderInput; output: WorkOrder };
  }
}

// No capability: raised from the guard app and resident helpdesk too, not just the console
// (PRD §8.5 step 1) — those actors' `role` isn't a `ConsoleRole`, so this command stays ungated
// at the dispatch layer, same as `occupancy.adjust` and P3's `booking.checkIn`.
defineCommand<'incident.raise'>({
  name: 'incident.raise',
  run: (ctx, input) => {
    const duplicate = findDuplicateIncident(
      Object.values(ctx.state.incidents),
      input.amenity,
      input.category,
      ctx.now,
    );

    const incidentId = id('inc');
    const incident: Incident = {
      id: incidentId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      amenity: input.amenity,
      category: input.category,
      severity: input.severity,
      description: input.description,
      photo: input.photo,
      raisedBy: ctx.actor.id,
      raisedVia: input.raisedVia,
      at: ctx.now,
      childId: input.childId,
    };
    ctx.state.incidents[incidentId] = incident;

    return {
      ok: true,
      value: { ...incident, duplicateOf: duplicate?.id },
      events: [],
      jobs: [],
      audit: {
        action: 'incident.raise',
        target: { type: 'incident', id: incidentId },
        after: { amenity: input.amenity, category: input.category },
      },
    } satisfies CommandResult<Incident & { duplicateOf?: string }>;
  },
});

defineCommand<'incident.merge'>(
  {
    name: 'incident.merge',
    run: (ctx, input) => {
      const incident = ctx.state.incidents[input.incidentId];
      const target = ctx.state.incidents[input.mergedInto];
      if (!incident || !target) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Incident not found.' } };
      }
      incident.mergedInto = input.mergedInto;
      incident.updatedAt = ctx.now;

      return {
        ok: true,
        value: incident,
        events: [],
        jobs: [],
        audit: {
          action: 'incident.merge',
          target: { type: 'incident', id: incident.id },
          after: { mergedInto: input.mergedInto },
        },
      } satisfies CommandResult<Incident>;
    },
  },
  { capability: 'incident.manage' },
);

defineCommand<'incident.convertToWorkOrder'>(
  {
    name: 'incident.convertToWorkOrder',
    run: (ctx, input) => {
      const incident = ctx.state.incidents[input.incidentId];
      if (!incident) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Incident not found.' } };
      }
      if (incident.amenity === 'creche') {
        return {
          ok: false,
          error: {
            code: 'NOT_ELIGIBLE',
            message: 'Creche incidents do not convert to work orders.',
          },
        };
      }

      const workOrderId = id('wo');
      const workOrder: WorkOrder = {
        id: workOrderId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        incidentId: incident.id,
        amenity: incident.amenity,
        title: input.title,
        priority: input.priority,
        assignee: input.assignee,
        state: 'assigned',
        sla: {
          ...computeSlaDeadlines(input.priority, ctx.now, rules.ops),
          pausedMs: 0,
          respondedAt: ctx.now,
        },
        timeline: [
          {
            at: ctx.now,
            by: ctx.actor.id,
            type: 'created',
            text: `Converted from incident ${incident.id}`,
          },
        ],
      };
      ctx.state.workOrders[workOrderId] = workOrder;
      incident.workOrderId = workOrderId;
      incident.updatedAt = ctx.now;

      return {
        ok: true,
        value: workOrder,
        events: [],
        jobs: [slaCheckJob(addMinutesIso(ctx.now, 15))],
        audit: {
          action: 'incident.convertToWorkOrder',
          target: { type: 'workOrder', id: workOrderId },
          after: { priority: input.priority },
        },
      } satisfies CommandResult<WorkOrder>;
    },
  },
  { capability: 'incident.manage' },
);
