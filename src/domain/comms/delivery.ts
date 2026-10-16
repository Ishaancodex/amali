/**
 * The delivery simulator (TRD §7.5, PRD §8.7): per-recipient timings are
 * pre-computed once, at send time, from a seeded rng stream, and stored
 * directly in `Delivery.times` — the `delivery.tick` job then only has to
 * compare `now` against that plan to derive the current `DeliveryState`,
 * never re-rolling anything. Pure.
 */
import { addMillisecondsIso } from '@/lib/time';
import type { Rng } from '@/lib/random';
import { rngBool, rngFloat } from '@/lib/random';
import type { Rules } from '@/config/rules.schema';
import type { Delivery, DeliveryState } from '@/types/comms';

/** A log-normal-shaped read-time offset (minutes after delivery) via Box-Muller — long-tail, matching PRD's "about 60% read within 15 minutes" curve. */
function logNormalMinutes(r: Rng, medianMinutes: number, sigma: number): number {
  const u1 = Math.max(r(), 1e-9);
  const u2 = r();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return medianMinutes * Math.exp(sigma * z);
}

export function planDeliveryTimes(
  r: Rng,
  queuedAt: string,
  isUrgent: boolean,
  delivery: Rules['comms']['delivery'],
): Delivery['times'] {
  const sentAt = addMillisecondsIso(
    queuedAt,
    rngFloat(r, delivery.sentMinSeconds, delivery.sentMaxSeconds) * 1000,
  );

  if (rngBool(r, delivery.failRate)) {
    return { queued: queuedAt, sent: sentAt, failed: sentAt };
  }

  const deliveredAt = addMillisecondsIso(
    sentAt,
    rngFloat(r, delivery.deliveredMinSeconds, delivery.deliveredMaxSeconds) * 1000,
  );

  if (rngBool(r, delivery.neverReadRate)) {
    return { queued: queuedAt, sent: sentAt, delivered: deliveredAt };
  }

  const medianMinutes = isUrgent
    ? delivery.readMedianMinutesUrgent
    : delivery.readMedianMinutesNormal;
  const readMinutes = Math.max(0.05, logNormalMinutes(r, medianMinutes, 0.9));
  const readAt = addMillisecondsIso(deliveredAt, readMinutes * 60 * 1000);

  return { queued: queuedAt, sent: sentAt, delivered: deliveredAt, read: readAt };
}

/** Derives the current `DeliveryState` by comparing `now` against the pre-computed `times` plan — never mutates, never re-rolls. */
export function resolveDeliveryState(times: Delivery['times'], now: string): DeliveryState {
  if (times.failed && now >= times.failed) return 'failed';
  if (times.read && now >= times.read) return 'read';
  if (times.delivered && now >= times.delivered) return 'delivered';
  if (times.sent && now >= times.sent) return 'sent';
  return 'queued';
}
