/**
 * Reports, generated on request (PRD §8.10): utilisation/occupancy by
 * amenity with weekday × hour heatmaps and the top 5 peak windows; no-show
 * and late-cancellation rates (weekly series, and repeat offenders for the
 * CM only); booking trends by day, tower and weekday; revenue by source
 * (only for a role that may see revenue); communication reach; and ops
 * (SLA compliance, open work orders, checklist completion, waitlist
 * conversion, covers). Every number goes through `domain/reports/kpis.ts`.
 * The role decides what's in it (PRD §8.11) — a supervisor's report only
 * covers their assigned amenities and has no revenue.
 */
import { rules } from '@/config/rules';
import { resolveSlaState } from '@/domain/ops/sla';
import {
  covers as coversKpi,
  lateCancellationRate,
  noShowRate,
  peakWindows,
  ratio,
  revenue as revenueKpi,
  slaCompliance,
  waitlistConversion,
  type Interval,
} from '@/domain/reports/kpis';
import {
  addDaysIso,
  dubaiDateKey,
  dubaiDateTimeToIso,
  dubaiWeekday,
  minutesBetween,
} from '@/lib/time';
import type { AmenityKey } from '@/types/amenity';
import type { Tower } from '@/types/community';
import type { ConsoleRole } from '@/types/demo';
import type { AppState } from '../types';
import { reportRows } from './reportRows';
import { reportScope, type Report, type ReportRequest } from './reportTypes';

export * from './reportTypes';
import { utilisationSection, type AmenityUtilisation } from './reportUtilisation';

export type { AmenityUtilisation };

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = dubaiDateTimeToIso(from, '12:00'); dubaiDateKey(d) <= to; d = addDaysIso(d, 1))
    out.push(dubaiDateKey(d));
  return out;
}

export function buildReport(
  s: AppState,
  request: ReportRequest,
  role: ConsoleRole,
  assigned: AmenityKey[] | undefined,
  now: string,
): Report {
  const scope = reportScope(role, assigned);
  const amenities = request.amenities.filter((a) => scope.amenities.includes(a));
  const range: Interval = {
    start: dubaiDateTimeToIso(request.from, '00:00'),
    end: addDaysIso(dubaiDateTimeToIso(request.to, '00:00'), 1),
  };
  const inRange = (iso: string) => iso >= range.start && iso < range.end;
  const dayKeys = days(request.from, request.to);
  const towerOk = (unitId: string) =>
    request.towers.length === 0 || request.towers.includes(s.units[unitId]?.tower as Tower);

  const rows = reportRows(s, inRange, towerOk, now);
  const { utilisationRows, heatmaps } = utilisationSection(s, amenities, dayKeys, rows);

  // No-shows.
  const byAmenity = amenities
    .filter((a) => rows[a]?.length)
    .map((a) => ({
      amenity: a,
      noShowRate: noShowRate(rows[a]!, now),
      lateCancelRate: lateCancellationRate(rows[a]!),
      bookings: rows[a]!.length,
    }));
  const weekly = byAmenity.map(({ amenity }) => ({
    amenity,
    points: dayKeys
      .filter((_, i) => i % 7 === 0)
      .map((weekStart, i) => {
        const end = dayKeys[Math.min(dayKeys.length - 1, i * 7 + 6)]!;
        const week = rows[amenity]!.filter(
          (r) => dubaiDateKey(r.start) >= weekStart && dubaiDateKey(r.start) <= end,
        );
        return { date: weekStart, value: noShowRate(week, now) ?? 0 };
      }),
  }));
  let offenders: Report['noShows']['offenders'];
  if (scope.offenders) {
    const counts = new Map<string, number>();
    for (const a of amenities)
      for (const r of rows[a] ?? [])
        if (r.outcome === 'no_show') counts.set(r.residentId, (counts.get(r.residentId) ?? 0) + 1);
    offenders = [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 10)
      .map(([residentId, count]) => ({
        residentId,
        name: s.residents[residentId]?.name ?? residentId,
        unitId: s.residents[residentId]?.unitId ?? '',
        count,
      }));
  }

  // Booking trends.
  const all = amenities.flatMap((a) => rows[a] ?? []);
  const perDay = new Map(dayKeys.map((d) => [d, 0]));
  const perTower = new Map<string, number>();
  const perWeekday = new Map<number, number>();
  for (const r of all) {
    const key = dubaiDateKey(r.start);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    const tower = s.units[r.unitId]?.tower ?? 'villas';
    perTower.set(tower, (perTower.get(tower) ?? 0) + 1);
    const wd = dubaiWeekday(r.start);
    perWeekday.set(wd, (perWeekday.get(wd) ?? 0) + 1);
  }

  // Revenue (CM only), communications, ops.
  const ledger = Object.values(s.ledger).filter((e) => inRange(e.at) && towerOk(e.unitId));
  const sentInRange = Object.values(s.announcements).filter((a) => a.sentAt && inRange(a.sentAt));
  const sentIds = new Set(sentInRange.map((a) => a.id));
  const deliveries = Object.values(s.deliveries).filter(
    (d) => sentIds.has(d.messageRef.id) && d.state !== 'skipped_opt_out',
  );
  const reached = deliveries.filter((d) => d.state === 'delivered' || d.state === 'read');
  const readMinutes = deliveries
    .filter((d) => d.times.read && d.times.sent)
    .map((d) => minutesBetween(d.times.sent!, d.times.read!))
    .sort((x, y) => x - y);
  const resolvedWos = Object.values(s.workOrders).filter(
    (w) => w.sla.resolvedAt && inRange(w.sla.resolvedAt) && amenities.includes(w.amenity),
  );
  const templates = Object.values(s.checklistTemplates);
  const runs = Object.values(s.checklistRuns).filter(
    (r) => r.completedAt && r.date >= request.from && r.date <= request.to,
  );
  const offers = Object.values(s.waitlist).filter(
    (w) => w.offer && inRange(w.offer.sentAt) && amenities.includes('padel'),
  );
  const woRows = resolvedWos
    .map((w) => ({
      id: w.id,
      amenity: w.amenity,
      title: w.title,
      priority: w.priority,
      createdAt: w.createdAt,
      resolvedAt: w.sla.resolvedAt!,
      withinSla:
        resolveSlaState(
          w.sla.resolveBy,
          w.createdAt,
          w.sla,
          w.sla.resolvedAt!,
          rules.ops.slaAtRiskFraction,
          w.sla.resolvedAt,
        ) !== 'breached',
    }))
    .sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt));
  const diningCovers = amenities.includes('dining')
    ? coversKpi(
        Object.values(s.reservations).filter((r) => r.venue === 'restaurant'),
        range,
      )
    : 0;

  return {
    request,
    role,
    amenities,
    utilisation: utilisationRows,
    heatmaps,
    peaks: Object.entries(heatmaps).map(([amenity, cells]) => ({
      amenity: amenity as AmenityKey,
      cells: peakWindows(cells!, 5),
    })),
    noShows: { byAmenity, weekly, offenders },
    trends: {
      daily: [...perDay.entries()].map(([date, value]) => ({ date, value })),
      byTower: [...perTower.entries()]
        .map(([tower, count]) => ({ tower, count }))
        .sort((a, b) => b.count - a.count),
      byWeekday: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        count: perWeekday.get(weekday) ?? 0,
      })),
    },
    revenue: scope.revenue ? revenueKpi(ledger) : undefined,
    comms: {
      messages: sentInRange.length,
      recipients: deliveries.length,
      deliveryRate: ratio(reached.length, deliveries.length),
      medianReadMinutes: readMinutes.length
        ? readMinutes[Math.floor(readMinutes.length / 2)]
        : undefined,
    },
    ops: {
      slaCompliance: slaCompliance(woRows),
      resolved: resolvedWos.length,
      openWorkOrders: Object.values(s.workOrders).filter(
        (w) => w.state !== 'closed' && w.state !== 'resolved' && amenities.includes(w.amenity),
      ).length,
      checklistCompletion: ratio(runs.length, templates.length * dayKeys.length),
      waitlistConversion: waitlistConversion(
        offers.map((w) => ({ accepted: w.state === 'accepted' })),
      ),
      covers: diningCovers,
    },
    workOrders: woRows,
  };
}
