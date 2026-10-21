'use client';

/**
 * A generated report (PRD §8.10 "Report contents"): only the sections
 * that were asked for, and only what the role may see (revenue and the
 * repeat-offender list are already absent for anyone but the CM).
 */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { BarChart, Heatmap, LineChart, StackedBar } from '@/features/reports/charts';
import { REVENUE_SOURCES, type RevenueSource } from '@/domain/reports/kpis';
import { useAmenityLabel, useFmt, useT } from '@/i18n/hooks';
import { cn } from '@/lib/cn';
import type { Report } from '@/store/selectors/report';
import type { AmenityKey } from '@/types/amenity';
import type { Tower } from '@/types/community';
import { motion } from 'motion/react';
import { fadeUp } from '@/design/motion';

/** The revenue lines are English data (the workbook's labels); each has a display key. */
const SOURCE_KEY = {
  'Guest fees': 'guestFees',
  'Event tickets': 'tickets',
  'F&B settled': 'fnb',
  'PDR minimum-spend top-ups': 'pdr',
  Teppanyaki: 'teppanyaki',
  'Creche fees': 'creche',
  'Late-pickup fees': 'latePickup',
} as const satisfies Record<RevenueSource, string>;

/** M23: real cards replace the skeletons with a cross-fade and a small rise. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} initial="initial" animate="animate">
      <Card className="flex flex-col gap-3">
        <h2 className="text-label-1 text-text-title">{title}</h2>
        {children}
      </Card>
    </motion.div>
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
  const t = useT();
  const fmt = useFmt();
  const amenityLabel = useAmenityLabel();
  const name = (a: AmenityKey) => amenityLabel(a, 'short');
  const pct = (v: number | undefined) => (v === undefined ? '—' : fmt.pct(v));
  const pct1 = (v: number | undefined) => (v === undefined ? '—' : fmt.pct(v, 1));
  const source = (s: RevenueSource) => t(`console.report.source.${SOURCE_KEY[s]}`);
  const has = (s: string) => report.request.sections.includes(s as never);
  const heatAmenities = Object.keys(report.heatmaps) as AmenityKey[];
  const [heat, setHeat] = useState<AmenityKey | undefined>(heatAmenities[0]);
  const shownHeat = heat && report.heatmaps[heat] ? heat : heatAmenities[0];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {has('utilisation') && (
        <Section title={t('console.report.section.utilisation')}>
          <BarChart
            data={report.utilisation
              .filter((u) => u.value !== undefined)
              .map((u) => ({ label: name(u.amenity), value: u.value! }))}
            format={pct}
          />
          <p className="text-body-3 text-text-muted">{t('console.report.utilisationNote')}</p>
        </Section>
      )}
      {has('peak') && shownHeat && (
        <Section title={t('console.report.section.peak')}>
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
                {name(a)}
              </button>
            ))}
          </div>
          <Heatmap cells={report.heatmaps[shownHeat] ?? []} />
          <ol className="text-body-3 text-text-body flex flex-col gap-0.5">
            {report.peaks
              .find((p) => p.amenity === shownHeat)
              ?.cells.map((c, i) => (
                <li key={`${c.weekday}:${c.hour}`}>
                  {i + 1}. {fmt.weekday(c.weekday, 'EEE')} {String(c.hour).padStart(2, '0')}:00 ·{' '}
                  {pct(c.value)}
                </li>
              ))}
          </ol>
        </Section>
      )}
      {has('noshow') && (
        <Section title={t('console.report.section.noshow')}>
          <table className="text-body-3 w-full text-start">
            <thead className="text-text-muted">
              <tr>
                <th className="text-start font-normal">{t('guard.amenity')}</th>
                <th className="text-end font-normal">{t('resident.activity.tab.bookings')}</th>
                <th className="text-end font-normal">{t('dining.state.no_show')}</th>
                <th className="text-end font-normal">{t('console.report.lateCancels')}</th>
              </tr>
            </thead>
            <tbody className="text-text-body">
              {report.noShows.byAmenity.map((n) => (
                <tr key={n.amenity}>
                  <td>{name(n.amenity)}</td>
                  <td className="text-end tabular-nums">{n.bookings}</td>
                  <td className="text-end tabular-nums">{pct1(n.noShowRate)}</td>
                  <td className="text-end tabular-nums">{pct(n.lateCancelRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <LineChart
            series={report.noShows.weekly.map((w) => ({
              name: name(w.amenity),
              points: w.points.map((p) => ({ label: p.date.slice(5), value: p.value })),
            }))}
            format={pct}
          />
          {report.noShows.offenders && report.noShows.offenders.length > 0 && (
            <div>
              <p className="text-label-3 text-text-muted mb-1">{t('console.report.offenders')}</p>
              {report.noShows.offenders.map((o) => (
                <p key={o.residentId} className="text-body-3 text-text-body">
                  {o.name} · <bdi>{o.unitId}</bdi> ·{' '}
                  {t('console.report.noShowCount', { count: o.count })}
                </p>
              ))}
            </div>
          )}
        </Section>
      )}
      {has('trends') && (
        <Section title={t('console.report.section.trends')}>
          <LineChart
            series={[
              {
                name: t('resident.activity.tab.bookings'),
                points: report.trends.daily.map((p) => ({
                  label: p.date.slice(5),
                  value: p.value,
                })),
              },
            ]}
            format={(v) => fmt.num(Math.round(v))}
          />
          <div className="grid grid-cols-2 gap-3">
            <BarChart
              data={report.trends.byWeekday.map((d) => ({
                label: fmt.weekday(d.weekday, 'EEE'),
                value: d.count,
              }))}
              format={(v) => fmt.num(v)}
            />
            <BarChart
              data={report.trends.byTower.map((tw) => ({
                label: t(`console.tower.${tw.tower as Tower}`),
                value: tw.count,
              }))}
              format={(v) => fmt.num(v)}
            />
          </div>
        </Section>
      )}
      {has('revenue') && report.revenue && (
        <Section title={`${t('console.overview.revenue')} · ${fmt.aed(report.revenue.total)}`}>
          <StackedBar
            parts={REVENUE_SOURCES.map((s) => ({
              name: source(s),
              value: report.revenue!.bySource[s],
            })).filter((p) => p.value > 0)}
            format={fmt.aed}
          />
          <table className="text-body-3 w-full">
            <tbody className="text-text-body">
              {REVENUE_SOURCES.map((s) => (
                <tr key={s}>
                  <td>{source(s)}</td>
                  <td className="text-end tabular-nums">{fmt.aed(report.revenue!.bySource[s])}</td>
                </tr>
              ))}
              <tr>
                <td>{t('console.report.refunds')}</td>
                <td className="text-end tabular-nums">−{fmt.aed(report.revenue.refunds)}</td>
              </tr>
              <tr className="text-label-2">
                <td>{t('common.total')}</td>
                <td className="text-end tabular-nums">{fmt.aed(report.revenue.total)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}
      {has('comms') && (
        <Section title={t('console.report.section.comms')}>
          <div className="flex flex-wrap gap-6">
            <Stat label={t('console.report.messages')} value={fmt.num(report.comms.messages)} />
            <Stat label={t('console.report.recipients')} value={fmt.num(report.comms.recipients)} />
            <Stat label={t('console.report.delivered')} value={pct(report.comms.deliveryRate)} />
            <Stat
              label={t('console.report.medianRead')}
              value={
                report.comms.medianReadMinutes === undefined
                  ? '—'
                  : t('console.announcement.minutes', { value: report.comms.medianReadMinutes })
              }
            />
          </div>
        </Section>
      )}
      {has('ops') && (
        <Section title={t('console.report.section.ops')}>
          <div className="flex flex-wrap gap-6">
            <Stat
              label={t('console.report.slaResolved', { count: report.ops.resolved })}
              value={pct(report.ops.slaCompliance)}
            />
            <Stat
              label={t('console.overview.openWorkOrders')}
              value={fmt.num(report.ops.openWorkOrders)}
            />
            <Stat
              label={t('console.report.checklists')}
              value={pct(report.ops.checklistCompletion)}
            />
            <Stat label={t('console.report.waitlist')} value={pct(report.ops.waitlistConversion)} />
            {report.amenities.includes('dining') && (
              <Stat label={t('console.report.covers')} value={fmt.num(report.ops.covers)} />
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
