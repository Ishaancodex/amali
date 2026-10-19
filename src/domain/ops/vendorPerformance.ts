/**
 * A vendor's SLA performance (PRD §8.8: "% within SLA, average resolution
 * time, and the number of breaches over 90 days"). Counts work orders
 * resolved inside the window; "within SLA" credits On-hold time exactly as
 * the live SLA clock does (`resolveSlaState`), so a paused work order
 * isn't scored as a breach it never was. Pure.
 */
import { addDaysIso, minutesBetween } from '@/lib/time';
import { pausedMsAt, resolveSlaState } from './sla';
import type { WorkOrder } from '@/types/ops';

export interface VendorPerformance {
  resolvedCount: number;
  pctWithinSla?: number;
  avgResolveMinutes?: number;
  breaches: number;
}

export function vendorPerformance(
  workOrders: readonly WorkOrder[],
  vendorId: string,
  now: string,
  atRiskFraction: number,
  windowDays = 90,
): VendorPerformance {
  const windowStart = addDaysIso(now, -windowDays);
  const resolved = workOrders.filter(
    (wo) =>
      wo.assignee.kind === 'vendor' &&
      wo.assignee.id === vendorId &&
      wo.sla.resolvedAt !== undefined &&
      wo.sla.resolvedAt >= windowStart &&
      wo.sla.resolvedAt <= now,
  );
  if (resolved.length === 0) return { resolvedCount: 0, breaches: 0 };

  let breaches = 0;
  let totalActiveMinutes = 0;
  for (const wo of resolved) {
    const resolvedAt = wo.sla.resolvedAt!;
    if (
      resolveSlaState(wo.sla.resolveBy, wo.createdAt, wo.sla, now, atRiskFraction, resolvedAt) ===
      'breached'
    )
      breaches += 1;
    totalActiveMinutes += Math.max(
      0,
      minutesBetween(wo.createdAt, resolvedAt) - Math.round(pausedMsAt(wo.sla, resolvedAt) / 60000),
    );
  }

  return {
    resolvedCount: resolved.length,
    pctWithinSla: Math.round(((resolved.length - breaches) / resolved.length) * 100),
    avgResolveMinutes: Math.round(totalActiveMinutes / resolved.length),
    breaches,
  };
}
