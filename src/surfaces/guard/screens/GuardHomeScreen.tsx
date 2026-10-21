'use client';

/**
 * The Guard app home (PRD §8.9): the pool's live +/- occupancy counter
 * (debounced 1s to the store, PRD's own number), an alerts inbox for
 * emergency closures with "Acknowledge", and a "Raise incident" entry
 * point. Padel-specific guard features (scan, arrivals, no-show sweep)
 * already have real commands from P3 but are out of this phase's scope —
 * P6's own deliverables are occupancy + alerts.
 */
import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, CircleAlert, Camera } from '@/ui/icons';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { EmptyState } from '@/ui/EmptyState';
import { RingGauge } from '@/ui/RingGauge';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { buildOccupancyEstimate } from '@/domain/ops/occupancy';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import { useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

export function GuardHomeScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const { push } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const staffMember = useStore((s) => s.staff[actorId]);
  const poolCapacity = useStore((s) => s.amenities.pool?.capacity ?? 40);
  const storedCount = useStore((s) => s.occupancy.pool ?? 0);
  const notifications = useStore((s) => s.notifications);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);

  const [localCount, setLocalCount] = useState(storedCount);
  const pendingDelta = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setLocalCount(storedCount), [storedCount]);
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  function adjust(delta: number) {
    setLocalCount((c) => Math.max(0, c + delta));
    pendingDelta.current += delta;
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const toSend = pendingDelta.current;
      pendingDelta.current = 0;
      if (toSend !== 0 && staffMember) {
        dispatch(
          'occupancy.adjust',
          { amenity: 'pool', delta: toSend },
          { kind: 'staff', id: staffMember.id, role: staffMember.role },
        );
      }
    }, 1000);
  }

  const estimate = buildOccupancyEstimate(localCount, poolCapacity);
  // PRD §8.5 edge case: during an emergency closure the counter must reach 0 before the pool shows "Cleared".
  const clearing = selectCurrentStatus({ amenityStatus }, 'pool', now) === 'emergency';

  const alerts = Object.values(notifications)
    .filter((n) => n.recipientId === actorId && n.priority === 'high' && !n.read)
    .sort((a, b) => b.at.localeCompare(a.at));

  function acknowledge(notificationId: string) {
    if (!staffMember) return;
    dispatch(
      'notification.acknowledge',
      { notificationId },
      { kind: 'staff', id: staffMember.id, role: staffMember.role },
    );
  }

  if (!staffMember) return null;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div>
        <span className="text-tag font-secondary text-brand">{t('guard.role')}</span>
        <h1 className="text-title-l text-text-title">{staffMember.name}</h1>
      </div>

      <Card className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-between self-stretch">
          <p className="text-label-1 text-text-title">
            {clearing ? t('guard.clearPool') : t('guard.poolOccupancy')}
          </p>
          {clearing && (
            <Tag variant={estimate.count === 0 ? 'success' : 'danger'}>
              {estimate.count === 0
                ? t('guard.cleared')
                : t('guard.stillIn', { count: estimate.count })}
            </Tag>
          )}
        </div>
        <RingGauge fraction={estimate.fraction} band={estimate.band} size={96} strokeWidth={8}>
          <span className="text-title-l text-text-title tabular-nums">{estimate.count}</span>
        </RingGauge>
        <p className="text-body-3 text-text-muted">
          {t('guard.of', { capacity: estimate.capacity })}
        </p>
        <div className="mt-1 flex items-center gap-4">
          <button
            type="button"
            onClick={() => adjust(-1)}
            aria-label={t('guard.oneOut')}
            className="border-border-card text-brand flex h-12 w-12 items-center justify-center rounded-full border active:scale-95"
          >
            <Minus className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => adjust(1)}
            aria-label={t('guard.oneIn')}
            className="bg-brand text-on-brand flex h-12 w-12 items-center justify-center rounded-full active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-label-1 text-text-title">{t('guard.alerts')}</h2>
        {alerts.length === 0 ? (
          <EmptyState icon={CircleAlert} message={t('guard.noAlerts')} />
        ) : (
          <div className="flex flex-col gap-2">
            {alerts.map((n) => (
              <Card key={n.id} className="flex items-start gap-2.5">
                <CircleAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="text-label-2 text-text-title">{n.title}</p>
                  <p className="text-body-3 text-text-muted">{n.body}</p>
                  <p className="text-body-3 text-text-placeholder mt-0.5">{fmt.time(n.at)}</p>
                </div>
                <Button variant="secondary" onClick={() => acknowledge(n.id)}>
                  {t('kids.acknowledge')}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Button variant="secondary" fullWidth onClick={() => push('raise-incident')}>
        <Camera className="me-2 inline h-4 w-4" strokeWidth={1.5} />
        {t('guard.raiseIncident')}
      </Button>
    </div>
  );
}
