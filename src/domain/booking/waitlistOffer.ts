/**
 * Waitlist offer mode and expiry (PRD §8.1): "offer it to #1 for 15
 * minutes... If less than 45 min remain before start -> open release:
 * offer to everyone on the waitlist at once." Pure.
 */
import { addMinutesIso, minutesBetween } from '@/lib/time';
import { rules } from '@/config/rules';
import type { WaitlistOfferMode } from '@/types/booking';

export interface OfferPlan {
  mode: WaitlistOfferMode;
  expiresAt: string;
}

/**
 * `slotStart`/`now` decide sequential vs open-release, and how long the
 * offer stays open — shortened so it never runs past
 * `minMinutesBeforeStartForOffer` before the slot starts.
 */
export function planOffer(now: string, slotStart: string): OfferPlan {
  const minutesToStart = minutesBetween(now, slotStart);
  const { sequentialOfferMinutes, minMinutesBeforeStartForOffer, openReleaseThresholdMinutes } =
    rules.padel.waitlist.offer;

  if (minutesToStart < openReleaseThresholdMinutes) {
    // Open release: offer stands until the slot starts (or is taken).
    return { mode: 'open_release', expiresAt: slotStart };
  }

  const maxExpiry = addMinutesIso(now, Math.max(0, minutesToStart - minMinutesBeforeStartForOffer));
  const standardExpiry = addMinutesIso(now, sequentialOfferMinutes);
  return { mode: 'sequential', expiresAt: standardExpiry < maxExpiry ? standardExpiry : maxExpiry };
}
