'use client';

/** A work order's two SLA clocks (PRD §8.5): respond and resolve, each with its state and countdown. */
import { Tag } from '@/ui/Tag';
import { resolveSlaState } from '@/domain/ops/sla';
import { rules } from '@/config/rules';
import { minutesBetween } from '@/lib/time';
import { useFmt, useT, type T } from '@/i18n/hooks';
import type { WorkOrder } from '@/types/ops';

const SLA_TAG = { on_track: 'success', at_risk: 'warning', breached: 'danger' } as const;

function countdownLabel(now: string, deadline: string, t: T): string {
  const minutes = minutesBetween(now, deadline);
  if (minutes <= 0) return t('console.woDetail.overdue', { m: Math.abs(minutes) });
  if (minutes < 60) return t('console.woDetail.leftM', { m: minutes });
  return t('console.woDetail.leftHm', { h: Math.floor(minutes / 60), m: minutes % 60 });
}

export function WorkOrderSla({ workOrder, now }: { workOrder: WorkOrder; now: string }) {
  const t = useT();
  const fmt = useFmt();
  const { sla } = workOrder;
  const clocks = [
    {
      key: 'respond',
      deadline: sla.respondBy,
      doneAt: sla.respondedAt,
      doneLabel: 'console.woDetail.respondedAt',
    },
    {
      key: 'resolve',
      deadline: sla.resolveBy,
      doneAt: sla.resolvedAt,
      doneLabel: 'console.woDetail.resolvedAt',
    },
  ] as const;

  return (
    <section>
      <h2 className="text-label-1 text-text-title mb-2">{t('console.woDetail.sla')}</h2>
      <div className="grid grid-cols-2 gap-3">
        {clocks.map((c) => {
          const state = resolveSlaState(
            c.deadline,
            workOrder.createdAt,
            sla,
            now,
            rules.ops.slaAtRiskFraction,
            c.doneAt,
          );
          return (
            <div key={c.key} className="rounded-card border-border-card border-[0.5px] p-3">
              <div className="flex items-center justify-between">
                <span className="text-label-2 text-text-title">
                  {t(`console.woDetail.${c.key}`)}
                </span>
                <Tag variant={SLA_TAG[state]}>{t(`console.sla.${state}`)}</Tag>
              </div>
              <p className="text-body-3 text-text-muted mt-1">
                {c.doneAt
                  ? t(c.doneLabel, { time: fmt.time(c.doneAt) })
                  : countdownLabel(now, c.deadline, t)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
