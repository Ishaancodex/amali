'use client';

/**
 * Overview (PRD §8.10, always live): every amenity's status for the role's
 * scope — a Community Manager sees all, an Amenity Supervisor their
 * assigned amenities, a Call-centre Agent statuses only — then today's
 * numbers and the last 7 days' KPIs (revenue only for a role that may see
 * it). Recomputed once a minute, not on every clock frame.
 */
import { useMemo } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { AmenityStatusTag } from '@/features/status/AmenityStatusTag';
import { useStore } from '@/store';
import { selectCurrentStatusEntry } from '@/store/selectors/amenities';
import {
  buildReport,
  REPORT_AMENITIES,
  REPORT_SECTIONS,
  reportScope,
} from '@/store/selectors/report';
import { grantFor } from '@/domain/rbac/can';
import { useAmenityLabel, useFmt, useT } from '@/i18n/hooks';
import { addDaysIso, dubaiDateKey } from '@/lib/time';
import type { AmenityKey } from '@/types/amenity';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';

const ALL: AmenityKey[] = ['padel', 'screening', 'music', 'creche', 'dining', 'pool', 'gym'];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-body-3 text-text-muted">{label}</span>
      <span className="text-title-l text-text-title tabular-nums">{value}</span>
      {hint && <span className="text-body-3 text-text-placeholder">{hint}</span>}
    </Card>
  );
}

export function OverviewScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const amenityLabel = useAmenityLabel();
  const pct = (v: number | undefined) => (v === undefined ? '—' : fmt.pct(v));
  const { consoleRole, assignedAmenities } = useConsoleActor(slot);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const nowMinute = useStore((s) => s.demo.clock.now.slice(0, 16));
  const bookings = useStore((s) => s.bookings);
  const rsvps = useStore((s) => s.rsvps);
  const reservations = useStore((s) => s.reservations);
  const workOrders = useStore((s) => s.workOrders);
  const ledger = useStore((s) => s.ledger);
  const now = `${nowMinute}:00.000Z`;

  const grant = consoleRole ? grantFor(consoleRole, 'overview_dashboard') : undefined;
  const statusesOnly = consoleRole === 'call_centre';
  const visible =
    grant?.scope === 'assigned' ? ALL.filter((a) => assignedAmenities?.includes(a)) : ALL;

  const report = useMemo(() => {
    if (!consoleRole || statusesOnly || !reportScope(consoleRole, assignedAmenities).allowed)
      return undefined;
    const today = dubaiDateKey(now);
    return buildReport(
      useStore.getState(),
      {
        from: dubaiDateKey(addDaysIso(now, -7)),
        to: today,
        amenities: [...REPORT_AMENITIES],
        towers: [],
        sections: [...REPORT_SECTIONS],
      },
      consoleRole,
      assignedAmenities,
      now,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the records listed are what the report reads
  }, [
    consoleRole,
    assignedAmenities,
    nowMinute,
    statusesOnly,
    bookings,
    rsvps,
    reservations,
    workOrders,
    ledger,
  ]);

  const today = dubaiDateKey(now);
  const todayBookings = report?.trends.daily.find((d) => d.date === today)?.value ?? 0;

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.nav.overview')} />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {visible.map((a) => {
            const entry = selectCurrentStatusEntry({ amenityStatus }, a, now);
            return (
              <Card key={a} className="flex flex-col gap-2">
                <span className="text-label-2 text-text-title">{amenityLabel(a)}</span>
                <AmenityStatusTag status={entry?.status ?? 'open'} />
                {entry?.reason && (
                  <span className="text-body-3 text-text-muted line-clamp-2">{entry.reason}</span>
                )}
              </Card>
            );
          })}
        </section>

        {statusesOnly ? (
          <p className="text-body-3 text-text-muted">{t('console.overview.statusesOnly')}</p>
        ) : report ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={t('console.overview.bookingsToday')} value={fmt.num(todayBookings)} />
              <Stat
                label={t('console.overview.openWorkOrders')}
                value={fmt.num(report.ops.openWorkOrders)}
              />
              <Stat
                label={t('console.overview.sla')}
                value={pct(report.ops.slaCompliance)}
                hint={t('console.water.lastDays', { days: 7 })}
              />
              {report.revenue && (
                <Stat
                  label={t('console.overview.revenue')}
                  value={fmt.aed(report.revenue.total)}
                  hint={t('console.water.lastDays', { days: 7 })}
                />
              )}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-label-1 text-text-title">
                {t('console.water.lastDays', { days: 7 })}
              </h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {report.utilisation.map((u) => (
                  <Stat
                    key={u.amenity}
                    label={t(`console.overview.${u.kind}`, {
                      amenity: amenityLabel(u.amenity, 'short'),
                    })}
                    value={pct(u.value)}
                  />
                ))}
                {report.noShows.byAmenity.map((n) => (
                  <Stat
                    key={`ns-${n.amenity}`}
                    label={t('console.overview.noShows', {
                      amenity: amenityLabel(n.amenity, 'short'),
                    })}
                    value={pct(n.noShowRate)}
                  />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
