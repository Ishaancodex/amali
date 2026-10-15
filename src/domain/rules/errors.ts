/**
 * The booking engine's shared error vocabulary (PRD §7 — the 11-check
 * table). `CommandError.code` (store/commands/types.ts) is one of these
 * for any booking-domain rejection. Messages are templates; `params` fills
 * in the specifics (a court closing time, a quota count, an amount).
 */

export type RuleCode =
  | 'NOT_ELIGIBLE'
  | 'SUSPENDED'
  | 'AMENITY_CLOSED'
  | 'BLACKOUT'
  | 'OUTSIDE_HOURS'
  | 'WINDOW_NOT_OPEN'
  | 'LEAD_TIME'
  | 'INVALID_DURATION'
  | 'SLOT_FULL'
  | 'SLOT_HELD'
  | 'QUOTA_EXCEEDED'
  | 'AGE_RESTRICTED'
  | 'GUEST_LIMIT'
  | 'INSUFFICIENT_BALANCE';

export interface RuleRejection {
  ok: false;
  code: RuleCode;
  message: string;
  params?: Record<string, string | number>;
  /** Up to 3 nearest valid alternative start times (checks 2-8 only — PRD §7). */
  alternatives?: string[];
}

export function reject(
  code: RuleCode,
  message: string,
  params?: Record<string, string | number>,
  alternatives?: string[],
): RuleRejection {
  return { ok: false, code, message, params, alternatives };
}

/** Checks 2-8 are the ones PRD §7 says should carry alternatives. */
export const ALTERNATIVES_ELIGIBLE: readonly RuleCode[] = [
  'AMENITY_CLOSED',
  'BLACKOUT',
  'OUTSIDE_HOURS',
  'WINDOW_NOT_OPEN',
  'LEAD_TIME',
  'INVALID_DURATION',
  'SLOT_FULL',
  'SLOT_HELD',
  'QUOTA_EXCEEDED',
];
