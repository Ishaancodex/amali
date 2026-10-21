'use client';

/**
 * A generated report (PRD §8.10 "Report contents"): only the sections
 * that were asked for, and only what the role may see (revenue and the
 * repeat-offender list are already absent for anyone but the CM).
 */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { BarChart, Heatmap, LineChart, StackedBar } from '@/features/reports/charts';
import { REVENUE_SOURCES } from '@/domain/reports/kpis';
import { fmtAed } from '@/lib/money';
import { cn } from '@/lib/cn';
import type { Report } from '@/store/selectors/report';
import type { AmenityKey } from '@/types/amenity';

const NAME: Record<string, string> = {
  padel: 'Padel',
  screening: 'Screening',
  music: 'Music',
  dining: 'Restaurant',
  pool: 'Pool',
  gym: 'Gym',
  creche: 'Kids’ Club',
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pct = (v: number | undefined) => (v === undefined ? '—' : `${Math.round(v * 100)}%`);
const pct1 = (v: number | undefined) => (v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-label-1 text-text-title">{title}</h2>
      {children}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-title-l text-text-title tabular-nums">{value}</span>
      <span className="text-body-3 text-text-muted">{label}</span>
    </div>
  );
}

export function ReportView({ report }: { report: Report }) {
  const has = (s: string) => report.request.sections.includes(s as never);
  const heatAmenities = Object.keys(report.heatmaps) as AmenityKey[];
  const [heat, setHeat] = useState<AmenityKey | undefined>(heatAmenities[0]);
  const shownHeat = heat && report.heatmaps[heat] ? heat : heatAmenities[0];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {has('utilisation') && (
        <Section title="Utilisation & occupancy">
          <BarChart
            data={report.utilisation
              .filter((u) => u.value !== undefined)
              .map((u) => ({ label: NAME[u.amenity] ?? u.amenity, value: u.value! }))}
            format={pct}
          />
          <p className="text-body-3 text-text-muted">
            Bookable: booked ÷ bookable minutes (open hours − blackouts). Pool, gym, Kids’ Club:
            average headcount ÷ capacity.
          </p>
        </Section>
      )}
      {has('peak') && shownHeat && (
        <Section title="Peak times">
          <div className="flex flex-wrap gap-1.5">
            {heatAmenities.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setHeat(a)}
                className={cn(
                  'rounded-tag text-label-3 px-2.5 py-1',
                  shownHeat === a ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                )}
              >
                {NAME[a]}
              </button>
            ))}
          </div>
          <Heatmap cells={report.heatmaps[shownHeat] ?? []} />
          <ol className="text-body-3 text-text-body flex flex-col gap-0.5">
            {report.peaks
              .find((p) => p.amenity === shownHeat)
              ?.cells.map((c, i) => (
                <li key={`${c.weekday}:${c.hour}`}>
                  {i + 1}. {DAYS[c.weekday]} {String(c.hour).padStart(2, '0')}:00 · {pct(c.value)}
                </li>
              ))}
          </ol>
        </Section>
      )}
      {has('noshow') && (
        <Section title="No-shows">
          <table className="text-body-3 w-full text-start">
            <thead className="text-text-muted">
              <tr>
                <th className="text-start font-normal">Amenity</th>
                <th className="text-end font-normal">Bookings</th>
                <th className="text-end font-normal">No-show</th>
                <th className="text-end font-normal">Late cancels</th>
              </tr>
            </thead>
            <tbody className="text-text-body">
              {report.noShows.byAmenity.map((n) => (
                <tr key={n.amenity}>
                  <td>{NAME[n.amenity]}</td>
                  <td className="text-end tabular-nums">{n.bookings}</td>
                  <td className="text-end tabular-nums">{pct1(n.noShowRate)}</td>
                  <td className="text-end tabular-nums">{pct(n.lateCancelRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <LineChart
            series={report.noShows.weekly.map((w) => ({
              name: NAME[w.amenity] ?? w.amenity,
              points: w.points.map((p) => ({ label: p.date.slice(5), value: p.value })),
            }))}
            format={pct}
          />
          {report.noShows.offenders && report.noShows.offenders.length > 0 && (
            <div>
              <p className="text-label-3 text-text-muted mb-1">Repeat offenders (CM only)</p>
              {report.noShows.offenders.map((o) => (
                <p key={o.residentId} className="text-body-3 text-text-body">
                  {o.name} · {o.unitId} · {o.count} no-shows
                </p>
              ))}
            </div>
          )}
        </Section>
      )}
      {has('trends') && (
        <Section title="Booking trends">
          <LineChart
            series={[
              {
                name: 'Bookings',
                points: report.trends.daily.map((p) => ({
                  label: p.date.slice(5),
                  value: p.value,
                })),
              },
            ]}
            format={(v) => String(Math.round(v))}
          />
          <div className="grid grid-cols-2 gap-3">
            <BarChart
              data={report.trends.byWeekday.map((d) => ({
                label: DAYS[d.weekday]!,
                value: d.count,
              }))}
              format={(v) => String(v)}
            />
            <BarChart
              data={report.trends.byTower.map((t) => ({
                label: t.tower[0]!.toUpperCase() + t.tower.slice(1),
                value: t.count,
              }))}
              format={(v) => String(v)}
            />
          </div>
        </Section>
      )}
      {has('revenue') && report.revenue && (
        <Section title={`Revenue · ${fmtAed(report.revenue.total)}`}>
          <StackedBar
            parts={REVENUE_SOURCES.map((s) => ({
              name: s,
              value: report.revenue!.bySource[s],
            })).filter((p) => p.value > 0)}
            format={fmtAed}
          />
          <table className="text-body-3 w-full">
            <tbody className="text-text-body">
              {REVENUE_SOURCES.map((s) => (
                <tr key={s}>
                  <td>{s}</td>
                  <td className="text-end tabular-nums">{fmtAed(report.revenue!.bySource[s])}</td>
                </tr>
              ))}
              <tr>
                <td>Refunds</td>
                <td className="text-end tabular-nums">−{fmtAed(report.revenue.refunds)}</td>
              </tr>
              <tr className="text-label-2">
                <td>Total</td>
                <td className="text-end tabular-nums">{fmtAed(report.revenue.total)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}
      {has('comms') && (
        <Section title="Communication reach">
          <div className="flex flex-wrap gap-6">
            <Stat label="Messages" value={String(report.comms.messages)} />
            <Stat label="Recipients" value={String(report.comms.recipients)} />
            <Stat label="Delivered" value={pct(report.comms.deliveryRate)} />
            <Stat
              label="Median time to read"
              value={
                report.comms.medianReadMinutes === undefined
                  ? '—'
                  : `${report.comms.medianReadMinutes} min`
              }
            />
          </div>
        </Section>
      )}
      {has('ops') && (
        <Section title="Ops & SLAs">
          <div className="flex flex-wrap gap-6">
            <Stat
              label={`SLA compliance (${report.ops.resolved} resolved)`}
              value={pct(report.ops.slaCompliance)}
            />
            <Stat label="Open work orders" value={String(report.ops.openWorkOrders)} />
            <Stat label="Checklists completed" value={pct(report.ops.checklistCompletion)} />
            <Stat label="Waitlist conversion" value={pct(report.ops.waitlistConversion)} />
            {report.amenities.includes('dining') && (
              <Stat label="Restaurant covers" value={String(report.ops.covers)} />
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
