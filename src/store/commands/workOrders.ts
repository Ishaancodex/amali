/**
 * Work order lifecycle (PRD §8.5 steps 4-8): assignment, the state
 * machine with its SLA pause/resume, and comments. "Vendor update" (S6
 * step 5) is just a `workOrder.transition` with a `note` — no separate
 * command, matching TRD §7.1's exact catalogue.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { addMinutesIso } from '@/lib/time';
import { pausedMsAt, resolveSlaState } from '@/domain/ops/sla';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Job } from '@/scheduler/queue';
import type {
  WorkOrder,
  WorkOrderAssignee,
  WorkOrderResolution,
  WorkOrderState,
} from '@/types/ops';

export interface WorkOrderAssignInput {
  workOrderId: string;
  assignee: WorkOrderAssignee;
}

export interface WorkOrderTransitionInput {
  workOrderId: string;
  toState: WorkOrderState;
  note?: string;
  /** Required to transition into 'closed' (PRD: "needs a resolution note... and the cost"). */
  resolution?: WorkOrderResolution;
}

export interface WorkOrderCommentInput {
  workOrderId: string;
  text: string;
}

export interface OpsSlaSweepInput {
  runAt: string;
}

declare module './types' {
  interface CommandRegistry {
    'workOrder.assign': { input: WorkOrderAssignInput; output: WorkOrder };
    'workOrder.transition': { input: WorkOrderTransitionInput; output: WorkOrder };
    'workOrder.comment': { input: WorkOrderCommentInput; output: WorkOrder };
    'ops.slaSweep': { input: OpsSlaSweepInput; output: undefined };
  }
}

const ALLOWED_TRANSITIONS: Record<WorkOrderState, readonly WorkOrderState[]> = {
  open: ['assigned'],
  assigned: ['in_progress', 'on_hold'],
  in_progress: ['on_hold', 'resolved'],
  on_hold: ['in_progress', 'resolved'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

defineCommand<'workOrder.assign'>(
  {
    name: 'workOrder.assign',
    run: (ctx, input) => {
      const workOrder = ctx.state.workOrders[input.workOrderId];
      if (!workOrder) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Work order not found.' } };
      }
      const previous = workOrder.assignee;
      workOrder.assignee = input.assignee;
      workOrder.updatedAt = ctx.now;
      // SLA clock keeps running across a reassignment (PRD §8.5 edge case) — the history shows both.
      workOrder.timeline.push({
        at: ctx.now,
        by: ctx.actor.id,
        type: 'reassigned',
        text: `${previous.kind}:${previous.id} → ${input.assignee.kind}:${input.assignee.id}`,
      });
      if (!workOrder.sla.respondedAt) workOrder.sla.respondedAt = ctx.now;

      return {
        ok: true,
        value: workOrder,
        events: [],
        jobs: [],
        audit: {
          action: 'workOrder.assign',
          target: { type: 'workOrder', id: workOrder.id },
          after: { assignee: input.assignee },
        },
      } satisfies CommandResult<WorkOrder>;
    },
  },
  { capability: 'work_order.manage', resolveAmenity: () => undefined },
);

defineCommand<'workOrder.transition'>(
  {
    name: 'workOrder.transition',
    run: (ctx, input) => {
      const workOrder = ctx.state.workOrders[input.workOrderId];
      if (!workOrder) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Work order not found.' } };
      }
      if (!ALLOWED_TRANSITIONS[workOrder.state].includes(input.toState)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Can't move from ${workOrder.state} to ${input.toState}.`,
          },
        };
      }
      if (input.toState === 'closed' && !input.resolution?.note) {
        return {
          ok: false,
          error: { code: 'NOT_ELIGIBLE', message: 'Closing a work order needs a resolution note.' },
        };
      }

      // The SLA clock pauses on entering On hold, and resumes (crediting the paused time) on leaving it.
      if (input.toState === 'on_hold' && !workOrder.sla.pausedSince) {
        workOrder.sla.pausedSince = ctx.now;
      } else if (workOrder.state === 'on_hold' && input.toState !== 'on_hold') {
        workOrder.sla.pausedMs = pausedMsAt(workOrder.sla, ctx.now);
        workOrder.sla.pausedSince = undefined;
      }

      if (!workOrder.sla.respondedAt && input.toState !== 'open') {
        workOrder.sla.respondedAt = ctx.now;
      }

      if (input.toState === 'resolved') {
        workOrder.sla.resolvedAt = ctx.now;
      } else if (input.toState !== 'closed') {
        workOrder.sla.resolvedAt = undefined; // reopened after a failed verification — the resolve clock runs again
      }

      workOrder.state = input.toState;
      workOrder.updatedAt = ctx.now;
      if (input.resolution) workOrder.resolution = input.resolution;
      workOrder.timeline.push({
        at: ctx.now,
        by: ctx.actor.id,
        type: 'transition',
        text: `${input.toState}${input.note ? ` — ${input.note}` : ''}`,
      });

      return {
        ok: true,
        value: workOrder,
        events: [],
        jobs: [],
        audit: {
          action: 'workOrder.transition',
          target: { type: 'workOrder', id: workOrder.id },
          after: { state: input.toState },
        },
      } satisfies CommandResult<WorkOrder>;
    },
  },
  { capability: 'work_order.manage', resolveAmenity: () => undefined },
);

defineCommand<'workOrder.comment'>(
  {
    name: 'workOrder.comment',
    run: (ctx, input) => {
      const workOrder = ctx.state.workOrders[input.workOrderId];
      if (!workOrder) {
        return { ok: false, error: { code: 'NOT_ELIGIBLE', message: 'Work order not found.' } };
      }
      workOrder.timeline.push({ at: ctx.now, by: ctx.actor.id, type: 'comment', text: input.text });
      workOrder.updatedAt = ctx.now;

      return {
        ok: true,
        value: workOrder,
        events: [],
        jobs: [],
        audit: { action: 'workOrder.comment', target: { type: 'workOrder', id: workOrder.id } },
      } satisfies CommandResult<WorkOrder>;
    },
  },
  { capability: 'work_order.manage', resolveAmenity: () => undefined },
);

const SLA_SWEEP_INTERVAL_MINUTES = 15;

function slaCheckJob(runAt: string): Job {
  return { id: `sla-check:${runAt}`, type: 'sla.check', runAt, payload: {} };
}

/**
 * The SLA breach sweep (PRD §8.5: "Breaches go to the community
 * manager"). System-fired, no capability — re-derives nothing in state
 * except a one-time `breachNotifiedAt` stamp so a breach is announced
 * once, then reschedules itself while any work order is still open.
 */
defineCommand<'ops.slaSweep'>({
  name: 'ops.slaSweep',
  run: (ctx) => {
    let pending = false;

    for (const wo of Object.values(ctx.state.workOrders)) {
      if (wo.state === 'closed') continue;
      pending = true;
      if (wo.sla.breachNotifiedAt) continue;

      const state = resolveSlaState(
        wo.sla.resolveBy,
        wo.createdAt,
        wo.sla,
        ctx.now,
        rules.ops.slaAtRiskFraction,
        wo.sla.resolvedAt,
      );
      if (state !== 'breached') continue;

      wo.sla.breachNotifiedAt = ctx.now;
      for (const staff of Object.values(ctx.state.staff)) {
        if (staff.role !== 'community_manager') continue;
        const notifId = id('notif');
        ctx.state.notifications[notifId] = {
          id: notifId,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          recipientId: staff.id,
          at: ctx.now,
          title: 'SLA breached',
          body: `${wo.title} (${wo.priority}) has breached its resolve-by SLA.`,
          deepLink: `amali://console/work-orders/${wo.id}`,
          priority: 'high',
          read: false,
        };
      }
    }

    const jobs: Job[] = pending
      ? [slaCheckJob(addMinutesIso(ctx.now, SLA_SWEEP_INTERVAL_MINUTES))]
      : [];
    return { ok: true, value: undefined, events: [], jobs } satisfies CommandResult<undefined>;
  },
});

export { slaCheckJob };
