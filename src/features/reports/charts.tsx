'use client';

/**
 * Report charts (PRD §8.10, M22): bars, lines, one stacked bar, and the
 * weekday × hour heatmap. Plain SVG scaled through the viewBox, coloured
 * only by theme variables.
 */
import type { HeatmapCell } from '@/types/report';

export const SERIES_COLOURS = [
  'var(--brand)',
  'var(--info)',
  'var(--success)',
  'var(--warning)',
  'var(--danger)',
  'var(--maintenance)',
  'var(--text-muted)',
];

// SVG user units.
const W = 560;
const H = 160;
const PAD = 24;

export function BarChart({
  data,
  format,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
}) {
  const max = Math.max(1e-9, ...data.map((d) => d.value));
  const gap = 10;
  const barW = (W - gap * (data.length - 1)) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H + 36}`} className="h-auto w-full" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const h = (d.value / max) * H;
        const x = i * (barW + gap);
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={PAD + H - h}
              width={barW}
              height={h}
              rx={4}
              fill={SERIES_COLOURS[0]}
              opacity={0.85}
            />
            <text
              x={x + barW / 2}
              y={PAD + H - h - 6}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-body)"
            >
              {format(d.value)}
            </text>
            <text
              x={x + barW / 2}
              y={PAD + H + 14}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({
  series,
  format,
}: {
  series: { name: string; points: { label: string; value: number }[] }[];
  format: (v: number) => string;
}) {
  const n = Math.max(1, ...series.map((s) => s.points.length));
  const max = Math.max(1e-9, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const x = (i: number) => PAD + (n === 1 ? 0 : (i / (n - 1)) * (W - PAD * 2));
  const y = (v: number) => PAD + H - (v / max) * H;
  const labels = series[0]?.points ?? [];
  const every = Math.ceil(labels.length / 6);
  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${W} ${H + PAD * 2}`}
        className="h-auto w-full"
        role="img"
        aria-label="Line chart"
      >
        <text x={0} y={PAD - 6} fontSize={10} fill="var(--text-placeholder)">
          {format(max)}
        </text>
        <line x1={PAD} x2={W - PAD} y1={PAD + H} y2={PAD + H} stroke="var(--border-card)" />
        {series.map((s, si) => (
          <path
            key={s.name}
            d={s.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
              .join(' ')}
            fill="none"
            stroke={SERIES_COLOURS[si % SERIES_COLOURS.length]}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
        {labels.map((p, i) =>
          i % every === 0 ? (
            <text
              key={p.label}
              x={x(i)}
              y={PAD + H + 16}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-muted)"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      {series.length > 1 && <Legend names={series.map((s) => s.name)} />}
    </div>
  );
}

export function StackedBar({
  parts,
  format,
}: {
  parts: { name: string; value: number }[];
  format: (v: number) => string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  let x = 0;
  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} 28`}
        className="h-auto w-full"
        role="img"
        aria-label="Revenue by source"
      >
        {parts.map((p, i) => {
          const w = (p.value / total) * W;
          const rect = (
            <rect
              key={p.name}
              x={x}
              y={0}
              width={w}
              height={28}
              fill={SERIES_COLOURS[i % SERIES_COLOURS.length]}
            />
          );
          x += w;
          return rect;
        })}
      </svg>
      <Legend names={parts.map((p) => `${p.name} · ${format(p.value)}`)} />
    </div>
  );
}

function Legend({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {names.map((name, i) => (
        <span key={name} className="text-body-3 text-text-muted flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: SERIES_COLOURS[i % SERIES_COLOURS.length] }}
          />
          {name}
        </span>
      ))}
    </div>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekday × hour, cell shade = value (0..1). */
export function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  if (hours.length === 0) return <p className="text-body-3 text-text-muted">No hours in range.</p>;
  const cw = (W - 40) / hours.length;
  const ch = 18;
  const at = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.value]));
  return (
    <svg
      viewBox={`0 0 ${W} ${ch * 7 + 20}`}
      className="h-auto w-full"
      role="img"
      aria-label="Peak-time heatmap"
    >
      {DAYS.map((d, wd) => (
        <g key={d}>
          <text x={0} y={wd * ch + ch - 5} fontSize={10} fill="var(--text-muted)">
            {d}
          </text>
          {hours.map((h, i) => {
            const v = at.get(`${wd}:${h}`);
            return (
              <rect
                key={h}
                x={40 + i * cw}
                y={wd * ch}
                width={cw - 2}
                height={ch - 2}
                rx={2}
                fill="var(--brand)"
                opacity={v === undefined ? 0.04 : 0.08 + Math.min(1, v) * 0.92}
              >
                <title>{`${d} ${String(h).padStart(2, '0')}:00 — ${v === undefined ? 'closed' : `${Math.round(v * 100)}%`}`}</title>
              </rect>
            );
          })}
        </g>
      ))}
      {hours.map((h, i) =>
        i % 2 === 0 ? (
          <text
            key={h}
            x={40 + i * cw + cw / 2}
            y={ch * 7 + 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-muted)"
          >
            {String(h).padStart(2, '0')}
          </text>
        ) : null,
      )}
    </svg>
  );
}
