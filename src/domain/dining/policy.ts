/**
 * Deposits and the no-show policy (PRD §8.4, mock). Private Dining holds a
 * flat deposit, Teppanyaki one per person; the Restaurant takes none —
 * until a resident has 2 no-shows in 60 days, after which their next 3
 * reservations need AED 50 per person. Late cancellation is within 24h
 * (PDR, Teppanyaki) or 2h (Restaurant). Pure.
 */
import { addDaysIso, addHoursIso, addMinutesIso } from '@/lib/time';
import type { Rules } from '@/config/rules.schema';
import type { Reservation, VenueKey } from '@/types/dining';

type DiningRules = Rules['dining'];

export interface RepeatNoShowStatus {
  required: boolean;
  /** How many more reservations still need the deposit. */
  remaining: number;
  noShows: number;
}

/** The restaurant's repeat-no-show deposit, for one resident's reservation history. */
export function repeatNoShowStatus(
  history: readonly Reservation[],
  now: string,
  dining: DiningRules,
): RepeatNoShowStatus {
  const { repeatThreshold, repeatWindowDays, depositAppliesNextReservations } =
    dining.restaurant.noShow;
  const noShows = history
    .filter((r) => r.venue === 'restaurant' && r.state === 'no_show')
    .map((r) => r.start)
    .sort();
  // The most recent no-show that completed a run of `repeatThreshold` within the window.
  let triggerAt: string | undefined;
  noShows.forEach((at, i) => {
    const windowStart = addDaysIso(at, -repeatWindowDays);
    const inWindow = noShows.slice(0, i + 1).filter((x) => x >= windowStart).length;
    if (inWindow >= repeatThreshold && addDaysIso(at, repeatWindowDays) >= now) triggerAt = at;
  });
  if (!triggerAt) return { required: false, remaining: 0, noShows: noShows.length };
  const since = history.filter(
    (r) =>
      r.venue === 'restaurant' &&
      r.createdAt > triggerAt! &&
      r.state !== 'declined' &&
      r.state !== 'cancelled',
  ).length;
  const remaining = Math.max(0, depositAppliesNextReservations - since);
  return { required: remaining > 0, remaining, noShows: noShows.length };
}

export function depositFor(
  venue: VenueKey,
  partySize: number,
  repeatNoShow: boolean,
  dining: DiningRules,
): number {
  if (venue === 'pdr') return dining.pdr.depositFils;
  if (venue === 'teppanyaki') return dining.teppanyaki.depositPerPersonFils * partySize;
  return repeatNoShow ? dining.restaurant.noShow.depositRequiredFils * partySize : 0;
}

export function isLateCancellation(
  venue: VenueKey,
  start: string,
  now: string,
  dining: DiningRules,
): boolean {
  return now > addHoursIso(start, -dining[venue].lateCancellationHoursBefore);
}

/** The host can mark a no-show after the grace period. */
export function noShowAllowedFrom(start: string, dining: DiningRules): string {
  return addMinutesIso(start, dining.restaurant.noShow.graceMinutes);
}

/** The system flags a still-unseated party here; the host confirms. */
export function autoFlagAt(start: string, dining: DiningRules): string {
  return addMinutesIso(start, dining.restaurant.noShow.autoFlagMinutes);
}

/** A no-show forfeits the deposit at Teppanyaki and Private Dining; the Restaurant charges no fee. */
export function forfeitsDeposit(venue: VenueKey): boolean {
  return venue !== 'restaurant';
}
