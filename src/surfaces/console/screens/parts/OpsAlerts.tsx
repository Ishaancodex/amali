'use client';

/**
 * The Ops home's alert strip (PRD §8.5): a live "pool open with no
 * lifeguard" warning with its "Set to Closed" prompt, the water reading
 * overdue tile, and this console user's unread high-priority alerts (SLA
 * breaches, lifeguard gaps raised by a sick shift) with "Acknowledge".
 */
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import { effectiveHoursForDate } from '@/domain/booking/hours';
import { findCoverageGaps, gapAt } from '@/domain/ops/roster';
import { isWaterReadingOverdue } from '@/domain/ops/water';
import { rules } from '@/config/rules';
import { dubaiDateKey } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../../useConsoleActor';

export function OpsAlerts({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { push } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const hours = useStore((s) => s.hours);
  const exceptions = useStore((s) => s.exceptions);
  const shifts = useStore((s) => s.shifts);
  const staff = useStore((s) => s.staff);
  const waterReadings = useStore((s) => s.waterReadings);
  const notifications = useStore((s) => s.notifications);
  const now = useStore((s) => s.demo.clock.now);
  const { actor, assignedAmenities } = useConsoleActor(slot);

  const poolStatus = selectCurrentStatus({ amenityStatus }, 'pool', now);
  const poolInService = poolStatus === 'open' || poolStatus === 'limited';
  const poolHours = effectiveHoursForDate(
    hours,
    Object.values(exceptions),
    'pool',
    dubaiDateKey(now),
  );
  const poolOpenNow =
    poolInService && !!poolHours && poolHours.open <= now && now < poolHours.close;

  const staffRoleById = new Map(Object.values(staff).map((s) => [s.id, s.role] as const));
  const lifeguardGapNow = poolOpenNow
    ? gapAt(
        findCoverageGaps(
          Object.values(shifts),
          'pool',
          'lifeguard',
          staffRoleById,
          poolHours.open,
          poolHours.close,
        ),
        now,
      )
    : undefined;

  const lastReading = Object.values(waterReadings).reduce<string | undefined>(
    (latest, r) => (!latest || r.at > latest ? r.at : latest),
    undefined,
  );
  const waterOverdue =
    poolOpenNow &&
    isWaterReadingOverdue(
      lastReading,
      now,
      rules.pool.waterReadingIntervalHours,
      rules.pool.waterReadingOverdueMinutes,
      poolHours.open,
    );

  const myAlerts = Object.values(notifications)
    .filter((n) => n.recipientId === actor?.id && n.priority === 'high' && !n.read)
    .sort((a, b) => b.at.localeCompare(a.at));

  function closePool() {
    if (!actor) return;
    const result = dispatch(
      'amenity.setStatus',
      { amenity: 'pool', status: 'closed', reason: t('console.ops.noLifeguardReason') },
      actor,
      { assignedAmenities },
    );
    pushToast(
      slot,
      result.ok ? t('console.ops.poolClosed') : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  function acknowledge(notificationId: string) {
    if (!actor) return;
    dispatch('notification.acknowledge', { notificationId }, actor);
  }

  if (!lifeguardGapNow && !waterOverdue && myAlerts.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      {lifeguardGapNow && (
        <Banner style="urgent" cta={{ label: t('console.ops.setClosed'), onClick: closePool }}>
          {t('console.ops.noLifeguard', {
            from: fmt.time(lifeguardGapNow.start),
            to: fmt.time(lifeguardGapNow.end),
          })}
        </Banner>
      )}
      {waterOverdue && (
        <Banner
          style="warning"
          cta={{ label: t('console.ops.logReading'), onClick: () => push('water') }}
        >
          {lastReading
            ? t('console.ops.waterOverdueLast', { time: fmt.time(lastReading) })
            : t('console.ops.waterOverdue')}
        </Banner>
      )}
      {myAlerts.map((n) => (
        <Banner
          key={n.id}
          style="warning"
          cta={{ label: t('kids.acknowledge'), onClick: () => acknowledge(n.id) }}
        >
          <span className="text-label-2">{n.title}</span> — {n.body}
        </Banner>
      ))}
    </section>
  );
}
