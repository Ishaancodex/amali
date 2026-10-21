'use client';

/**
 * Arrivals (PRD §8.4): the service's bookings in time order — Seat,
 * Mark no-show (after the 15-minute grace; the +30 auto-flag shows red),
 * open for party size / notes / bill — and Walk-in (+).
 */
import { Button } from '@/ui/Button';
import { Tag } from '@/ui/Tag';
import { EmptyState } from '@/ui/EmptyState';
import { CalendarDays, CircleAlert, Gift, Plus, Clock } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { noShowAllowedFrom } from '@/domain/dining/policy';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { ServicePeriod, VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';
import { useService, hasAllergy } from '../../useService';

const STATE_TAG = {
  requested: 'warning',
  confirmed: 'brand',
  seated: 'success',
  completed: 'info',
  no_show: 'danger',
} as const;

export function Arrivals({
  slot,
  venue,
  period,
  onOpen,
  onWalkIn,
}: {
  slot: DeviceSlotId;
  venue: VenueKey;
  period: ServicePeriod | undefined;
  onOpen: (id: string) => void;
  onWalkIn: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { inService, now } = useService(venue, period);
  const residents = useStore((s) => s.residents);
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const role = useStore((s) => s.staff[actorId]?.role);
  const pushToast = useUiStore((s) => s.pushToast);
  const actor = { kind: 'staff' as const, id: actorId, role };

  const list = inService.filter((r) => r.state in STATE_TAG);

  function run(name: 'dining.seat' | 'dining.markNoShow', reservationId: string, done: string) {
    const result = dispatch(name, { reservationId }, actor);
    pushToast(slot, result.ok ? done : errorText(result.error), result.ok ? 'success' : 'error');
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-label-1 text-text-title">{t('fnb.arrivals')}</h2>
        <Button variant="secondary" onClick={onWalkIn}>
          <Plus className="me-1 inline h-4 w-4" strokeWidth={1.5} />
          {t('fnb.walkIn')}
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={CalendarDays} message={t('fnb.noBookings')} />
      ) : (
        list.map((r) => {
          const state = r.state as keyof typeof STATE_TAG;
          const canNoShow =
            r.state === 'confirmed' && now >= noShowAllowedFrom(r.start, rules.dining);
          return (
            <div
              key={r.id}
              className={`rounded-card border-[0.5px] p-3 ${r.noShowFlaggedAt && r.state === 'confirmed' ? 'border-danger' : 'border-border-card'}`}
            >
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                className="flex w-full items-start gap-2 text-start"
              >
                <span className="text-label-2 text-text-title tabular-nums">
                  {fmt.time(r.start)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-label-2 text-text-title flex items-center gap-1">
                    <span className="truncate">
                      {r.walkIn
                        ? t('fnb.walkIn')
                        : (residents[r.residentId]?.name ?? t('fnb.guest'))}
                    </span>
                    {hasAllergy(r.dietary) && (
                      <CircleAlert className="text-danger h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    )}
                    {r.occasion && (
                      <Gift className="text-brand h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    )}
                  </span>
                  <span className="text-body-3 text-text-muted block">
                    {r.partySize} · {r.tableIds.join('+') || t('fnb.noTable')}
                    {r.runningLateMinutes
                      ? ` · ${t('fnb.minLate', { minutes: r.runningLateMinutes })}`
                      : ''}
                  </span>
                </span>
                <Tag variant={STATE_TAG[state]}>{t(`fnb.state.${state}`)}</Tag>
              </button>
              {r.noShowFlaggedAt && r.state === 'confirmed' && (
                <p className="text-body-3 text-danger mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t('fnb.autoFlagged', { time: fmt.time(r.noShowFlaggedAt) })}
                </p>
              )}
              {r.state === 'confirmed' && (
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => run('dining.seat', r.id, t('fnb.seatedToast'))}
                  >
                    {t('fnb.seat')}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!canNoShow}
                    onClick={() => run('dining.markNoShow', r.id, t('fnb.markedNoShow'))}
                  >
                    {t('dining.state.no_show')}
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
