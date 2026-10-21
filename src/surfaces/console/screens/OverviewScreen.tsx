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
import { fmtAed } from '@/lib/money';
import { addDaysIso, dubaiDateKey } from '@/lib/time';
import type { AmenityKey } from '@/types/amenity';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';

const ALL: AmenityKey[] = ['padel', 'screening', 'music', 'creche', 'dining', 'pool', 'gym'];
const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`);

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
  const { consoleRole, assignedAmenities } = useConsoleActor(slot);
  const amenities = useStore((s) => s.amenities);
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
      <TopBar title="Overview" />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {visible.map((a) => {
            const entry = selectCurrentStatusEntry({ amenityStatus }, a, now);
            return (
              <Card key={a} className="flex flex-col gap-2">
                <span className="text-label-2 text-text-title">{amenities[a]?.name ?? a}</span>
                <AmenityStatusTag status={entry?.status ?? 'open'} />
                {entry?.reason && (
                  <span className="text-body-3 text-text-muted line-clamp-2">{entry.reason}</span>
                )}
              </Card>
            );
          })}
        </section>

        {statusesOnly ? (
          <p className="text-body-3 text-text-muted">
            Statuses only for the Call-centre Agent. Use Residents to book or cancel on someone’s
            behalf.
          </p>
        ) : report ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Bookings today" value={String(todayBookings)} />
              <Stat label="Open work orders" value={String(report.ops.openWorkOrders)} />
              <Stat
                label="SLA compliance"
                value={pct(report.ops.slaCompliance)}
                hint="Last 7 days"
              />
              {report.revenue && (
                <Stat label="Revenue" value={fmtAed(report.revenue.total)} hint="Last 7 days" />
              )}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="text-label-1 text-text-title">Last 7 days</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {report.utilisation.map((u) => (
                  <Stat
                    key={u.amenity}
                    label={`${amenities[u.amenity]?.name ?? u.amenity} ${u.kind}`}
                    value={pct(u.value)}
                  />
                ))}
                {report.noShows.byAmenity.map((n) => (
                  <Stat
                    key={`ns-${n.amenity}`}
                    label={`${amenities[n.amenity]?.name ?? n.amenity} no-shows`}
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
