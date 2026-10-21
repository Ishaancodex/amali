/** Shared constants and helpers for the seed history generators. */
import { rules } from '@/config/rules';
import type { AppState } from '@/store/types';
import type { LedgerEntry } from '@/types/wallet';

export const H = rules.seedHistory;
/** Bookings per day off-peak / in the peak window — tuned so padel utilisation reads ~45–70% at peak. */
export const PADEL_PER_DAY = { offPeak: [2, 4], peak: [4, 6] } as const;
export const PADEL_LATE_CANCEL = 0.04;
export const PADEL_CANCEL = 0.08;
export const GUEST_SHARE = 0.25;
export const WAITLIST_PER_PEAK_DAY = 1;
export const DINNERS_PER_DAY = [3, 6] as const;
export const ANNOUNCEMENT_EVERY_DAYS = 12;
export const ANNOUNCEMENT_AUDIENCE = 40;
/** Days ago the 3-day pool maintenance started (PRD: "a visible dip during a past 3-day pool maintenance"). */
export const POOL_MAINTENANCE_DAYS_AGO = 40;

/**
 * Exact-rate outcomes: the n-th booking is a no-show when the running quota ticks over, so a
 * 30- or 90-day report shows the PRD's rate (padel 9%, events 14%, restaurant 6%) rather than
 * whatever a small random sample happened to give.
 */
export const quota = { padel: 0, events: 0, restaurant: 0 };
export function takesQuota(kind: keyof typeof quota): boolean {
  const n = quota[kind]++;
  const rate = H.noShowRate[kind];
  return Math.floor((n + 1) * rate) > Math.floor(n * rate);
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export type PickResident = () => AppState['residents'][string];
export type Ledger = (e: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'>, id: string) => void;
