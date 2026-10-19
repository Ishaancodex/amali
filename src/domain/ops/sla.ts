/**
 * The SLA engine (PRD §8.5/§8.8): respond-by/resolve-by deadlines from
 * priority, a clock that pauses while On hold, "at risk" at 75% of time
 * used, "breached" once used. Pure.
 */
import { addMillisecondsIso, secondsBetween } from '@/lib/time';
import type { Rules } from '@/config/rules.schema';
import type { Priority, WorkOrderSla } from '@/types/ops';

export type SlaState = 'on_track' | 'at_risk' | 'breached';

function msBetween(a: string, b: string): number {
  return secondsBetween(a, b) * 1000;
}

export function computeSlaDeadlines(
  priority: Priority,
  createdAt: string,
  ops: Rules['ops'],
): { respondBy: string; resolveBy: string } {
  const band = ops.sla[priority];
  return {
    respondBy: addMillisecondsIso(createdAt, band.respondMinutes * 60 * 1000),
    resolveBy: addMillisecondsIso(createdAt, band.resolveMinutes * 60 * 1000),
  };
}

/** Time actually spent paused by `at` — the ongoing pause (if any) plus every completed one. */
export function pausedMsAt(
  sla: Pick<WorkOrderSla, 'pausedMs' | 'pausedSince'>,
  at: string,
): number {
  if (!sla.pausedSince) return sla.pausedMs;
  return sla.pausedMs + Math.max(0, msBetween(sla.pausedSince, at));
}

/**
 * The state of one SLA clock (respond or resolve). `frozenAt` — e.g.
 * `respondedAt`, or the work order's resolved/closed timestamp — stops
 * the clock at that instant instead of ticking against `now`; omit it for
 * a still-running clock.
 */
export function resolveSlaState(
  deadlineIso: string,
  createdAt: string,
  sla: Pick<WorkOrderSla, 'pausedMs' | 'pausedSince'>,
  now: string,
  atRiskFraction: number,
  frozenAt?: string,
): SlaState {
  const at = frozenAt ?? now;
  const totalAllottedMs = Math.max(1, msBetween(createdAt, deadlineIso));
  const activeElapsedMs = Math.max(0, msBetween(createdAt, at) - pausedMsAt(sla, at));
  const fractionUsed = activeElapsedMs / totalAllottedMs;
  if (fractionUsed >= 1) return 'breached';
  if (fractionUsed >= atRiskFraction) return 'at_risk';
  return 'on_track';
}
