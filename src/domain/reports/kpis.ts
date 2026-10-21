/**
 * KPI calculators (PRD §8.10 — the formulas exactly). Each takes plain,
 * already-normalised inputs so it can be tested on a hand-made dataset:
 *
 * - Utilisation (bookable) = booked minutes ÷ bookable minutes (open hours − blackouts)
 * - Occupancy (non-bookable) = average headcount ÷ capacity, per hour
 * - Peak time = the weekday × hour cells with the highest utilisation or occupancy
 * - No-show rate = no-shows ÷ (bookings whose start has passed and that were not cancelled)
 * - Late cancellation rate = late cancels ÷ all cancels
 * - Waitlist conversion = offers accepted ÷ offers sent
 * - Revenue = guest fees + event tickets + F&B settled + PDR minimum-spend top-ups
 *             + Teppanyaki + creche fees + late-pickup fees − refunds
 * - Covers = seated guests per service period
 * - SLA compliance = work orders resolved within SLA ÷ work orders resolved
 *
 * A ratio with nothing to divide by is `undefined` ("—"), never 0 or NaN. Pure.
 */
import { addMinutesIso, minutesBetween } from '@/lib/time';
import type { HeatmapCell } from '@/types/report';
import type { LedgerEntry } from '@/types/wallet';

export function ratio(n: number, d: number): number | undefined {
  return d > 0 ? n / d : undefined;
}

export interface Interval {
  start: string;
  end: string;
}

/** Minutes of [a] that fall inside [b]. */
export function overlapMinutes(a: Interval, b: Interval): number {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return end > start ? minutesBetween(start, end) : 0;
}

/** Open minutes in the windows, less any blackout minutes inside them. */
export function bookableMinutes(
  openWindows: readonly Interval[],
  blackouts: readonly Interval[],
): number {
  let total = 0;
  for (const w of openWindows) {
    total += minutesBetween(w.start, w.end);
    for (const b of blackouts) total -= overlapMinutes(w, b);
  }
  return Math.max(0, total);
}

export function utilisation(
  booked: readonly Interval[],
  openWindows: readonly Interval[],
  blackouts: readonly Interval[],
): number | undefined {
  const bookedMinutes = booked.reduce(
    (sum, b) => sum + openWindows.reduce((s, w) => s + overlapMinutes(b, w), 0),
    0,
  );
  return ratio(bookedMinutes, bookableMinutes(openWindows, blackouts));
}

/** Occupancy from hourly headcount samples (raw headcounts, one per open hour). */
export function occupancy(
  hourlyHeadcounts: readonly number[],
  capacity: number,
): number | undefined {
  if (hourlyHeadcounts.length === 0 || capacity <= 0) return undefined;
  return hourlyHeadcounts.reduce((a, b) => a + b, 0) / hourlyHeadcounts.length / capacity;
}

export type Outcome = 'attended' | 'no_show' | 'cancelled' | 'late_cancelled' | 'upcoming';

export interface BookingOutcome {
  start: string;
  outcome: Outcome;
}

export function noShowRate(items: readonly BookingOutcome[], now: string): number | undefined {
  const due = items.filter(
    (i) =>
      i.start <= now &&
      i.outcome !== 'cancelled' &&
      i.outcome !== 'late_cancelled' &&
      i.outcome !== 'upcoming',
  );
  return ratio(due.filter((i) => i.outcome === 'no_show').length, due.length);
}

export function lateCancellationRate(items: readonly BookingOutcome[]): number | undefined {
  const cancels = items.filter((i) => i.outcome === 'cancelled' || i.outcome === 'late_cancelled');
  return ratio(cancels.filter((i) => i.outcome === 'late_cancelled').length, cancels.length);
}

export function waitlistConversion(offers: readonly { accepted: boolean }[]): number | undefined {
  return ratio(offers.filter((o) => o.accepted).length, offers.length);
}

export type RevenueSource =
  | 'Guest fees'
  | 'Event tickets'
  | 'F&B settled'
  | 'PDR minimum-spend top-ups'
  | 'Teppanyaki'
  | 'Creche fees'
  | 'Late-pickup fees';

export const REVENUE_SOURCES: readonly RevenueSource[] = [
  'Guest fees',
  'Event tickets',
  'F&B settled',
  'PDR minimum-spend top-ups',
  'Teppanyaki',
  'Creche fees',
  'Late-pickup fees',
];

/** Which revenue line a ledger charge belongs to (from its reference and label); undefined = not revenue. */
export function revenueSourceOf(
  e: Pick<LedgerEntry, 'kind' | 'label' | 'ref'>,
): RevenueSource | undefined {
  const label = e.label.toLowerCase();
  switch (e.ref?.type) {
    case 'booking':
      return 'Guest fees';
    case 'rsvp':
      return 'Event tickets';
    case 'reservation':
      if (label.includes('minimum spend')) return 'PDR minimum-spend top-ups';
      if (label.includes('teppanyaki')) return 'Teppanyaki';
      return 'F&B settled';
    case 'crecheBooking':
      return label.includes('late') ? 'Late-pickup fees' : 'Creche fees';
    default:
      return undefined;
  }
}

export interface RevenueBreakdown {
  bySource: Record<RevenueSource, number>;
  refunds: number;
  total: number;
}

/** Charges by source, less refunds — all in fils, positive. */
export function revenue(
  entries: readonly Pick<LedgerEntry, 'kind' | 'label' | 'ref' | 'fils'>[],
): RevenueBreakdown {
  const bySource = Object.fromEntries(REVENUE_SOURCES.map((s) => [s, 0])) as Record<
    RevenueSource,
    number
  >;
  let refunds = 0;
  for (const e of entries) {
    if (e.kind === 'refund') {
      if (e.ref) refunds += Math.abs(e.fils);
      continue;
    }
    if (e.kind !== 'charge') continue;
    const source = revenueSourceOf(e);
    if (source) bySource[source] += Math.abs(e.fils);
  }
  const gross = Object.values(bySource).reduce((a, b) => a + b, 0);
  return { bySource, refunds, total: gross - refunds };
}

/** Seated guests (seated, completed and walk-ins) for one service period. */
export function covers(
  reservations: readonly { start: string; state: string; partySize: number }[],
  period: Interval,
): number {
  return reservations
    .filter(
      (r) =>
        r.start >= period.start &&
        r.start < period.end &&
        (r.state === 'seated' || r.state === 'completed'),
    )
    .reduce((s, r) => s + r.partySize, 0);
}

export function slaCompliance(resolved: readonly { withinSla: boolean }[]): number | undefined {
  return ratio(resolved.filter((r) => r.withinSla).length, resolved.length);
}

/** Booked minutes ÷ open minutes in each weekday × hour cell (bookable amenities). */
export function utilisationHeatmap(
  booked: readonly Interval[],
  openWindows: readonly Interval[],
  weekdayOf: (iso: string) => number,
  hourOf: (iso: string) => number,
): HeatmapCell[] {
  const open = new Map<string, number>();
  const used = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, m: number) =>
    map.set(key, (map.get(key) ?? 0) + m);
  for (const w of openWindows) {
    for (let t = w.start; t < w.end; t = addMinutesIso(t, 60)) {
      const key = `${weekdayOf(t)}:${hourOf(t)}`;
      const slot = { start: t, end: addMinutesIso(t, 60) < w.end ? addMinutesIso(t, 60) : w.end };
      add(open, key, minutesBetween(slot.start, slot.end));
      for (const b of booked) add(used, key, overlapMinutes(b, slot));
    }
  }
  return [...open.entries()].map(([key, m]) => {
    const [weekday, hour] = key.split(':').map(Number) as [number, number];
    return { weekday: weekday as HeatmapCell['weekday'], hour, value: (used.get(key) ?? 0) / m };
  });
}

/** Average of samples per weekday × hour cell (occupancy amenities). */
export function averageHeatmap(
  samples: readonly { weekday: number; hour: number; value: number }[],
): HeatmapCell[] {
  const sum = new Map<string, { total: number; n: number }>();
  for (const s of samples) {
    const key = `${s.weekday}:${s.hour}`;
    const cur = sum.get(key) ?? { total: 0, n: 0 };
    sum.set(key, { total: cur.total + s.value, n: cur.n + 1 });
  }
  return [...sum.entries()].map(([key, { total, n }]) => {
    const [weekday, hour] = key.split(':').map(Number) as [number, number];
    return { weekday: weekday as HeatmapCell['weekday'], hour, value: total / n };
  });
}

/** The top N cells — PRD "the top 5 peak windows". */
export function peakWindows(cells: readonly HeatmapCell[], n = 5): HeatmapCell[] {
  return [...cells]
    .sort((a, b) => b.value - a.value || a.weekday - b.weekday || a.hour - b.hour)
    .slice(0, n);
}
