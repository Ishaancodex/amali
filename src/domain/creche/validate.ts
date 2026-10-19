/**
 * Creche booking and check-in checks (PRD §8.3), in order. Both return the
 * shared `RuleRejection` shape (domain/rules/errors.ts) so the UI shows a
 * creche rejection the same way as a padel or RSVP one.
 */
import { addDaysIso, addHoursIso, addMinutesIso, minutesBetween } from '@/lib/time';
import { reject, type RuleRejection } from '@/domain/rules/errors';
import type { AgeBand, Child, CrecheBooking, CrecheSession } from '@/types/creche';
import { BAND_LABEL, type BandResult } from './bands';
import type { GuardianCheck } from './guardians';

export interface ValidateCrecheBookingInput {
  now: string;
  child: Child;
  actorUnitId: string | undefined;
  session: Pick<CrecheSession, 'start' | 'end' | 'kind'>;
  band: BandResult;
  /** This child's other active bookings, to catch a double booking of an overlapping slot. */
  childOverlapping: number;
  /** Active bookings in the child's band overlapping the session, and that band's capacity. */
  bandCount: number;
  bandCapacity: number;
  roomCount: number;
  roomCap: number;
  windowDays: number;
  leadTimeHours: number;
  dropIn: { minHours: number; maxHours: number };
}

export type CrecheBookingCheck =
  | { ok: true; band: AgeBand; state: 'confirmed' }
  | { ok: true; band: AgeBand; state: 'waitlisted'; reason: string }
  | RuleRejection;

export function validateCrecheBooking(input: ValidateCrecheBookingInput): CrecheBookingCheck {
  const { now, child, session, band } = input;

  // 1 — a child is registered against a unit; only that unit's residents book for them.
  if (!input.actorUnitId || input.actorUnitId !== child.unitId) {
    return reject('NOT_ELIGIBLE', `Only residents of ${child.unitId} can book for ${child.name}.`);
  }
  // 2 — age band.
  if (!band.ok) return reject('AGE_RESTRICTED', band.message, { age: band.age });
  // 3 — window and lead time.
  if (session.start > addDaysIso(now, input.windowDays)) {
    return reject('WINDOW_NOT_OPEN', `Bookings open ${input.windowDays} days ahead.`, {
      days: input.windowDays,
    });
  }
  if (session.start < addHoursIso(now, input.leadTimeHours)) {
    return reject('LEAD_TIME', `Book at least ${input.leadTimeHours}h before the session starts.`, {
      hours: input.leadTimeHours,
    });
  }
  // 4 — drop-in length.
  if (session.kind === 'dropin') {
    const hours = minutesBetween(session.start, session.end) / 60;
    if (hours < input.dropIn.minHours || hours > input.dropIn.maxHours) {
      return reject(
        'INVALID_DURATION',
        `Drop-in blocks are ${input.dropIn.minHours}–${input.dropIn.maxHours} hours.`,
      );
    }
  }
  // 5 — one place per child per slot.
  if (input.childOverlapping > 0) {
    return reject('ALREADY_BOOKED', `${child.name} is already booked for this time.`);
  }
  // 6 — ratio capacity and the room cap: full means the waitlist, not a refusal.
  if (input.bandCount >= input.bandCapacity) {
    return {
      ok: true,
      band: band.band,
      state: 'waitlisted',
      reason: `${BAND_LABEL[band.band]} band is full (${input.bandCount}/${input.bandCapacity}).`,
    };
  }
  if (input.roomCount >= input.roomCap) {
    return {
      ok: true,
      band: band.band,
      state: 'waitlisted',
      reason: `The playroom is at its ${input.roomCap}-child cap.`,
    };
  }
  return { ok: true, band: band.band, state: 'confirmed' };
}

export interface ValidateCheckInInput {
  now: string;
  child: Child | undefined;
  guardian: GuardianCheck;
  /** The child's booking for the session running now, if any. */
  booking: CrecheBooking | undefined;
  session: Pick<CrecheSession, 'start' | 'end'> | undefined;
  opensMinutesBefore: number;
  band: AgeBand;
  /** Children of this band already in the room, and the staff-driven capacity. */
  inRoom: number;
  capacity: number;
  roomInRoom: number;
  roomCap: number;
  /** For a walk-in (no booking): active bookings in this band for the session. */
  bandBooked: number;
  allergyAck: boolean;
}

export type CheckInCheck = { ok: true } | RuleRejection;

export function validateCheckIn(input: ValidateCheckInInput): CheckInCheck {
  const { child, booking, session, now } = input;
  if (!child) return reject('NOT_REGISTERED', 'This child is not registered with the Kids’ Club.');
  if (!input.guardian.ok) return reject('GUARDIAN_NOT_AUTHORISED', input.guardian.message);

  if (
    !session ||
    now < addMinutesIso(session.start, -input.opensMinutesBefore) ||
    now >= session.end
  ) {
    return reject('NO_SESSION', 'No session is running for this child right now.');
  }
  if (booking?.state === 'waitlisted') {
    return reject('NO_SESSION', `${child.name} is on the waitlist for this session.`);
  }
  if (!booking && input.bandBooked >= input.capacity) {
    return reject('NO_SESSION', 'No booking, and no drop-in places left in this band.');
  }

  const label = BAND_LABEL[input.band];
  if (input.inRoom + 1 > input.capacity) {
    return reject(
      'RATIO_EXCEEDED',
      `${label} band at ${input.inRoom}/${input.capacity} — add staff or wait.`,
      { inRoom: input.inRoom, capacity: input.capacity },
    );
  }
  if (input.roomInRoom + 1 > input.roomCap) {
    return reject('ROOM_FULL', `The playroom is at its ${input.roomCap}-child cap.`);
  }
  if (child.allergies?.severe && !input.allergyAck) {
    return reject(
      'ALLERGY_ACK_REQUIRED',
      `Severe allergy: ${child.allergies.text}. Tick “Allergy plan noted” to continue.`,
    );
  }
  return { ok: true };
}
