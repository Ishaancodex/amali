/**
 * The booking-domain shared error vocabulary — originally PRD §7's padel
 * 11-check table, extended in P4 with event/RSVP codes (PRD §8.2) that
 * reuse the same shape and the same AGE_RESTRICTED/GUEST_LIMIT/
 * INSUFFICIENT_BALANCE codes where the rule is identical in spirit.
 * `CommandError.code` (store/commands/types.ts) is one of these for any
 * booking-domain rejection. Messages are templates; `params` fills in the
 * specifics (a court closing time, a quota count, an amount).
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
  | 'INSUFFICIENT_BALANCE'
  // P4 — events/RSVP (PRD §8.2)
  | 'REGISTRATION_CLOSED'
  | 'SHOWTIME_FULL'
  | 'SHOWTIME_HELD'
  | 'SEAT_TAKEN'
  | 'SEAT_COUNT_MISMATCH'
  | 'VENUE_CONFLICT'
  // P7 — creche (PRD §8.3)
  | 'NOT_REGISTERED'
  | 'GUARDIAN_NOT_AUTHORISED'
  | 'NO_SESSION'
  | 'RATIO_EXCEEDED'
  | 'ROOM_FULL'
  | 'ALLERGY_ACK_REQUIRED'
  | 'ALREADY_BOOKED';

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
