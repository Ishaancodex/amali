/**
 * Padel penalty — strikes and suspensions (PRD §8.1: "3 strikes (no-show
 * or late cancel) in 30 days -> suspended for 7 days. Told at strike 2
 * (warning) and strike 3 (suspension)"). Pure.
 */
import { addDaysIso } from '@/lib/time';
import { rules } from '@/config/rules';
import type { Strike, Suspension } from '@/types/booking';

/** Strikes within the rolling penalty window ending at `nowIso`. */
export function activeStrikes(residentStrikes: readonly Strike[], nowIso: string): Strike[] {
  const windowStart = addDaysIso(nowIso, -rules.padel.penalty.windowDays);
  return residentStrikes.filter((s) => s.at >= windowStart && s.at <= nowIso);
}

export function isCurrentlySuspended(
  suspensions: readonly Suspension[],
  nowIso: string,
): Suspension | undefined {
  return suspensions.find((s) => s.from <= nowIso && nowIso < s.to && !s.liftedBy);
}

export type StrikeOutcome = { strikeCount: number; suspends: boolean; warns: boolean };

/** What adding one more strike does, given the count *before* this one (so pass `activeStrikes(...).length`). */
export function nextStrikeOutcome(priorActiveStrikeCount: number): StrikeOutcome {
  const strikeCount = priorActiveStrikeCount + 1;
  return {
    strikeCount,
    suspends: strikeCount >= rules.padel.penalty.strikesToSuspend,
    warns: strikeCount === rules.padel.penalty.warnAtStrike,
  };
}
