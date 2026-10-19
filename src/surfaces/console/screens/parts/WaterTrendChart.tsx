'use client';

/**
 * The 7-day water trend (PRD §8.5: "a trend chart shows the last 7 days
 * with the acceptable bands shaded"). One parameter at a time — pH, free
 * chlorine or temperature — on a shared time axis; a reading outside the
 * band is drawn as a danger-coloured dot.
 */
import { useState } from 'react';
import { useStore } from '@/store';
import { rules } from '@/config/rules';
import { addDaysIso, fmtDate, secondsBetween } from '@/lib/time';
import { cn } from '@/lib/cn';

type Param = 'ph' | 'freeChlorine' | 'tempC';

const PARAMS: { key: Param; label: string }[] = [
  { key: 'ph', label: 'pH' },
  { key: 'freeChlorine', label: 'Chlorine (ppm)' },
  { key: 'tempC', label: 'Temp (°C)' },
];

const DAYS = 7;
// SVG user units (the chart scales to its container via viewBox), not CSS pixels.
const W = 600;
const H = 160;
const PAD_X = 8;
const PAD_Y = 12;

export function WaterTrendChart() {
  const waterReadings = useStore((s) => s.waterReadings);
  const now = useStore((s) => s.demo.clock.now);
  const [param, setParam] = useState<Param>('ph');

  const wq = rules.pool.waterQuality;
  const band = param === 'ph' ? wq.ph : param === 'freeChlorine' ? wq.freeChlorinePpm : wq.tempC;
  const from = addDaysIso(now, -DAYS);
  const readings = Object.values(waterReadings)
    .filter((r) => r.at >= from && r.at <= now)
    .sort((a, b) => a.at.localeCompare(b.at));

  const values = readings.map((r) => r[param]);
  const span = band.max - band.min;
  const yMin = Math.min(band.min - span * 0.5, ...values);
  const yMax = Math.max(band.max + span * 0.5, ...values);
  const totalSeconds = DAYS * 24 * 3600;
  const x = (at: string) => PAD_X + (secondsBetween(from, at) / totalSeconds) * (W - PAD_X * 2);
  const y = (v: number) => PAD_Y + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD_Y * 2);
  const path = readings
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${x(r.at).toFixed(1)},${y(r[param]).toFixed(1)}`)
    .join(' ');

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-label-1 text-text-title">Last 7 days</h2>
        <div className="flex gap-1">
          {PARAMS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setParam(p.key)}
              className={cn(
                'rounded-tag text-label-3 px-2.5 py-1',
                param === p.key ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {readings.length === 0 ? (
        <p className="text-body-3 text-text-muted">No readings in the last 7 days.</p>
      ) : (
        <div className="rounded-card border-border-card border-[0.5px] p-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`${PARAMS.find((p) => p.key === param)?.label} over the last 7 days`}
          >
            <rect
              x={PAD_X}
              y={y(band.max)}
              width={W - PAD_X * 2}
              height={y(band.min) - y(band.max)}
              fill="var(--success)"
              opacity={0.12}
            />
            <path
              d={path}
              fill="none"
              stroke="var(--brand)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {readings.map((r) => {
              const out = r[param] < band.min || r[param] > band.max;
              return (
                <circle
                  key={r.id}
                  cx={x(r.at)}
                  cy={y(r[param])}
                  r={out ? 4 : 2}
                  fill={out ? 'var(--danger)' : 'var(--brand)'}
                />
              );
            })}
          </svg>
          <div className="text-body-3 text-text-placeholder flex justify-between px-1">
            <span>{fmtDate(from)}</span>
            <span>
              Band {band.min}–{band.max}
            </span>
            <span>{fmtDate(now)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
