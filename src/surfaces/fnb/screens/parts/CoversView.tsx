'use client';

/**
 * Covers (PRD §8.4): per service period, booked / seated / no-show /
 * walk-in, the covers forecast (reservations plus the average walk-in rate
 * for the same period over the last 7 days), and a bar chart of the last
 * 7 days' served covers.
 */
import { Card } from '@/ui/Card';
import { rules } from '@/config/rules';
import { addDaysIso, dubaiDateKey, dubaiDateTimeToIso, fmtDate, fmtTime } from '@/lib/time';
import { periodsFor } from '@/domain/dining/periods';
import { coversByDay, coversFor, coversForecast } from '@/domain/dining/service';
import type { ServicePeriod, VenueKey } from '@/types/dining';
import { useService } from '../../useService';

const HISTORY_DAYS = 7;
// SVG user units (scaled to the container through the viewBox).
const W = 560;
const H = 140;
const BAR_GAP = 12;
/** Headroom above the tallest bar for its value label. */
const TOP = 16;

const LABEL: Record<ServicePeriod, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  iftar: 'Iftar',
  dinner: 'Dinner',
};

export function CoversView({
  venue,
  period,
}: {
  venue: VenueKey;
  period: ServicePeriod | undefined;
}) {
  const { windows, window, all, dateKey } = useService(venue, period);
  const venueRes = all.filter((r) => r.venue === venue);
  const noon = dubaiDateTimeToIso(dateKey, '12:00');
  const pastWindows = Array.from({ length: HISTORY_DAYS }, (_, i) =>
    periodsFor(venue, dubaiDateKey(addDaysIso(noon, -(i + 1))), rules.dining).find(
      (w) => w.period === window.period,
    ),
  ).filter((w): w is NonNullable<typeof w> => !!w);
  const history = coversByDay(venueRes, dateKey, HISTORY_DAYS);
  const max = Math.max(1, ...history.map((d) => d.covers));
  const barW = (W - BAR_GAP * (HISTORY_DAYS - 1)) / HISTORY_DAYS;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {windows.map((w) => {
          const c = coversFor(venueRes, w);
          const selected = w.period === window.period;
          return (
            <Card
              key={w.period}
              className={selected ? 'border-brand flex flex-col gap-2' : 'flex flex-col gap-2'}
            >
              <p className="text-label-1 text-text-title">
                {LABEL[w.period]}{' '}
                <span className="text-body-3 text-text-muted">
                  {fmtTime(w.start)}–{fmtTime(w.end)}
                </span>
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    ['Booked', c.booked],
                    ['Seated', c.seated],
                    ['No-show', c.noShow],
                    ['Walk-in', c.walkIn],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <p className="text-title-l text-text-title tabular-nums">{v}</p>
                    <p className="text-body-3 text-text-muted">{k}</p>
                  </div>
                ))}
              </div>
              {selected && (
                <p className="text-body-3 text-brand">
                  Forecast {coversForecast(venueRes, w, pastWindows)} covers (bookings + average
                  walk-ins)
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <Card className="flex flex-col gap-2">
        <p className="text-label-1 text-text-title">Covers served, last {HISTORY_DAYS} days</p>
        <svg
          viewBox={`0 0 ${W} ${TOP + H + 20}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Covers served over the last ${HISTORY_DAYS} days`}
        >
          {history.map((d, i) => {
            const h = (d.covers / max) * H;
            const xPos = i * (barW + BAR_GAP);
            return (
              <g key={d.dateKey}>
                <rect
                  x={xPos}
                  y={TOP + H - h}
                  width={barW}
                  height={h}
                  rx={4}
                  fill="var(--brand)"
                  opacity={0.8}
                />
                <text
                  x={xPos + barW / 2}
                  y={TOP + H - h - 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-muted)"
                >
                  {d.covers}
                </text>
                <text
                  x={xPos + barW / 2}
                  y={TOP + H + 15}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-muted)"
                >
                  {fmtDate(dubaiDateTimeToIso(d.dateKey, '12:00'), 'EEE')}
                </text>
              </g>
            );
          })}
        </svg>
      </Card>
    </div>
  );
}
