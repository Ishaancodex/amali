/**
 * The delivery analytics view (PRD §8.7): a funnel per channel, time-to-
 * reach metrics, and the reach meter ("182 of 190 reached in 0:42"). Pure
 * — reads `Delivery` rows the caller already filtered to one announcement.
 */
import { minutesBetween, secondsBetween } from '@/lib/time';
import type { Channel, Delivery, DeliveryState } from '@/types/comms';

export interface ChannelFunnel {
  channel: Channel;
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

const COUNTABLE_STATES: readonly DeliveryState[] = [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
];

/** One funnel row per channel present in `deliveries` — PRD M21's bar-per-channel view. */
export function buildFunnel(deliveries: readonly Delivery[]): ChannelFunnel[] {
  const byChannel = new Map<Channel, ChannelFunnel>();
  for (const d of deliveries) {
    let row = byChannel.get(d.channel);
    if (!row) {
      row = { channel: d.channel, total: 0, queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
      byChannel.set(d.channel, row);
    }
    row.total += 1;
    if (COUNTABLE_STATES.includes(d.state)) {
      // A delivery's state is its most-advanced reached stage — count it there and at every stage it passed through.
      if (d.state === 'read') row.read += 1;
      if (d.state === 'read' || d.state === 'delivered') row.delivered += 1;
      if (d.state === 'read' || d.state === 'delivered' || d.state === 'sent') row.sent += 1;
      if (d.state !== 'failed' && d.state !== 'held_quiet_hours') row.queued += 1;
      if (d.state === 'failed') row.failed += 1;
    }
  }
  return [...byChannel.values()];
}

export interface TimeToReach {
  medianDeliverMinutes?: number;
  timeTo50PctReadMinutes?: number;
  timeTo90PctReadMinutes?: number;
}

/** Median time-to-deliver, and the elapsed time (from `sentAt`) at which 50%/90% of the whole audience had read it. */
export function computeTimeToReach(deliveries: readonly Delivery[], sentAt: string): TimeToReach {
  const deliverMinutes = deliveries
    .map((d) => d.times.delivered)
    .filter((t): t is string => !!t)
    .map((t) => minutesBetween(sentAt, t))
    .sort((a, b) => a - b);
  const medianDeliverMinutes = deliverMinutes.length > 0 ? median(deliverMinutes) : undefined;

  const readMinutesSorted = deliveries
    .map((d) => d.times.read)
    .filter((t): t is string => !!t)
    .map((t) => minutesBetween(sentAt, t))
    .sort((a, b) => a - b);

  const total = deliveries.length;
  const timeTo50PctReadMinutes = percentileReachMinutes(readMinutesSorted, total, 0.5);
  const timeTo90PctReadMinutes = percentileReachMinutes(readMinutesSorted, total, 0.9);

  return { medianDeliverMinutes, timeTo50PctReadMinutes, timeTo90PctReadMinutes };
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/** The elapsed-minutes value at which `fraction` of the whole audience had read it, or undefined if fewer than that fraction ever will. */
function percentileReachMinutes(
  readMinutesSorted: number[],
  totalAudience: number,
  fraction: number,
): number | undefined {
  if (totalAudience === 0) return undefined;
  const neededCount = Math.ceil(totalAudience * fraction);
  if (readMinutesSorted.length < neededCount) return undefined;
  return readMinutesSorted[neededCount - 1];
}

export interface ReachSummary {
  reached: number;
  total: number;
  elapsedSeconds: number;
}

/** "182 of 190 reached in 0:42" — `reached` counts anything at or past `delivered`. */
export function reachSummary(
  deliveries: readonly Delivery[],
  sentAt: string,
  now: string,
): ReachSummary {
  const reached = deliveries.filter((d) => d.state === 'delivered' || d.state === 'read').length;
  return {
    reached,
    total: deliveries.length,
    elapsedSeconds: Math.max(0, secondsBetween(sentAt, now)),
  };
}

export function fmtElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
