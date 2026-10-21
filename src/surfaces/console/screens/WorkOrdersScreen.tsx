'use client';

/**
 * Work orders (PRD §8.8): a filterable list with SLA state per card.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Tag } from '@/ui/Tag';
import { EmptyState } from '@/ui/EmptyState';
import { Wrench } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { resolveSlaState } from '@/domain/ops/sla';
import { rules } from '@/config/rules';
import type { DeviceSlotId } from '@/types/demo';
import type { WorkOrderState } from '@/types/ops';
import { useAmenityLabel, useT } from '@/i18n/hooks';

const STATES: WorkOrderState[] = [
  'open',
  'assigned',
  'in_progress',
  'on_hold',
  'resolved',
  'closed',
];
const SLA_TAG = { on_track: 'success', at_risk: 'warning', breached: 'danger' } as const;

export function WorkOrdersScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const amenityLabel = useAmenityLabel();
  const { pop, push } = useNav(slot);
  const workOrders = useStore((s) => s.workOrders);
  const now = useStore((s) => s.demo.clock.now);
  const [stateFilter, setStateFilter] = useState<WorkOrderState | 'all'>('all');

  const list = Object.values(workOrders)
    .filter((wo) => stateFilter === 'all' || wo.state === stateFilter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.wo.title')} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(['all', ...STATES] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStateFilter(s)}
                className={`rounded-tag text-label-3 px-3 py-1.5 ${stateFilter === s ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'}`}
              >
                {s === 'all' ? t('console.all') : t(`console.woState.${s}`)}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <EmptyState icon={Wrench} message={t('console.wo.none')} />
          ) : (
            list.map((wo) => {
              const sla =
                wo.state === 'closed'
                  ? 'on_track'
                  : resolveSlaState(
                      wo.sla.resolveBy,
                      wo.createdAt,
                      wo.sla,
                      now,
                      rules.ops.slaAtRiskFraction,
                      wo.sla.resolvedAt,
                    );
              return (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => push('work-order-detail', { id: wo.id })}
                  className="rounded-card border-border-card bg-surface flex items-center justify-between border-[0.5px] px-4 py-3 text-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Tag variant="brand">{wo.priority}</Tag>
                      <span className="text-label-2 text-text-title truncate">{wo.title}</span>
                    </div>
                    <p className="text-body-3 text-text-muted mt-0.5">
                      {amenityLabel(wo.amenity, 'short')} ·{' '}
                      {t(`console.assignee.${wo.assignee.kind}`)} ·{' '}
                      {t(`console.woState.${wo.state}`)}
                    </p>
                  </div>
                  <Tag variant={SLA_TAG[sla]}>{t(`console.sla.${sla}`)}</Tag>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
