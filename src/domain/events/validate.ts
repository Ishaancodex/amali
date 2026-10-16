/**
 * `validateRsvp` (PRD §8.2): every RSVP attempt goes through this, resident
 * or waitlist promotion. Checks run in order; the first failure wins —
 * mirroring `domain/booking/validate.ts`'s pattern for padel. Pure.
 */
import { rules } from '@/config/rules';
import { reject, type RuleRejection } from '@/domain/rules/errors';
import { occupiedAttendeeCount, confirmedAttendeeCount, remainingCapacity } from './capacity';
import { confirmedSeats, heldSeats } from './seats';
import { partyFeeFils } from './pricing';
import type { ProgrammeEvent, Showtime, Rsvp, AttendeeCategory } from '@/types/event';

export interface ValidateRsvpAttendee {
  category: AttendeeCategory;
  seat?: string;
}

export interface ValidateRsvpInput {
  now: string;
  event: ProgrammeEvent;
  showtime: Showtime;
  attendees: ValidateRsvpAttendee[];
  /** Every RSVP (any state) for this showtime. */
  showtimeRsvps: readonly Rsvp[];
  /** Exclude this RSVP's own prior hold from conflict checks (re-validating at confirm time). */
  excludeRsvpId?: string;
  walletBalanceFils: number;
}

export type ValidateRsvpResult = { ok: true } | RuleRejection;

const CLOSED_STATES: readonly Showtime['state'][] = [
  'cancelled',
  'closed',
  'in_progress',
  'completed',
];

export function validateRsvp(input: ValidateRsvpInput): ValidateRsvpResult {
  const { now, event, showtime, attendees, showtimeRsvps, excludeRsvpId } = input;
  const venueRules = event.venue === 'screening' ? rules.screening : rules.music;

  // 1 — registration window
  if (
    CLOSED_STATES.includes(showtime.state) ||
    now < showtime.regOpens ||
    now >= showtime.regCloses
  ) {
    return reject('REGISTRATION_CLOSED', 'Registration for this showtime is closed.');
  }

  // 2 — age rating
  const hasChildGuest = attendees.some((a) => a.category === 'guest_child');
  if (hasChildGuest && (event.ageRating === 'PG-13' || event.ageRating === '18+')) {
    return reject(
      'AGE_RESTRICTED',
      `This event is rated ${event.ageRating} — children cannot attend.`,
      {
        rating: event.ageRating,
      },
    );
  }

  // 3 — guest allowance
  const guestCount = attendees.filter(
    (a) => a.category === 'guest_adult' || a.category === 'guest_child',
  ).length;
  if (guestCount > venueRules.maxGuestsPerUnitPerShowtime) {
    return reject(
      'GUEST_LIMIT',
      `Up to ${venueRules.maxGuestsPerUnitPerShowtime} guests per showtime.`,
      {
        max: venueRules.maxGuestsPerUnitPerShowtime,
      },
    );
  }

  // 4 — capacity
  const occupied = occupiedAttendeeCount(showtimeRsvps, excludeRsvpId);
  const confirmedOnly = confirmedAttendeeCount(showtimeRsvps);
  const remaining = remainingCapacity(showtime.capacity, showtime.blockedSeats, occupied);
  if (attendees.length > remaining) {
    const remainingConfirmedOnly = remainingCapacity(
      showtime.capacity,
      showtime.blockedSeats,
      confirmedOnly,
    );
    if (attendees.length <= remainingConfirmedOnly) {
      return reject(
        'SHOWTIME_HELD',
        'Someone is completing their registration. Join the waitlist?',
      );
    }
    return reject('SHOWTIME_FULL', 'This showtime is full. Join the waitlist?');
  }

  // 5 — seat selection (Screening Room only)
  if (showtime.capacityMode === 'seats') {
    const seats = attendees.map((a) => a.seat);
    const uniqueSeats = new Set(seats);
    if (seats.some((s) => !s) || uniqueSeats.size !== attendees.length) {
      return reject('SEAT_COUNT_MISMATCH', 'Choose one seat per attendee.');
    }
    const confirmed = confirmedSeats(showtimeRsvps);
    const held = heldSeats(showtimeRsvps, excludeRsvpId);
    for (const seat of uniqueSeats) {
      const seatId = seat as string;
      if (showtime.blockedSeats.includes(seatId) || confirmed.has(seatId)) {
        return reject('SEAT_TAKEN', `Seat ${seatId} is already taken.`, { seat: seatId });
      }
      if (held.has(seatId)) {
        return reject('SHOWTIME_HELD', `Seat ${seatId} is being held by someone else.`, {
          seat: seatId,
        });
      }
    }
  }

  // 6 — wallet balance covers guest fees
  const feeFils = partyFeeFils(attendees, event.pricing);
  if (feeFils > input.walletBalanceFils) {
    return reject(
      'INSUFFICIENT_BALANCE',
      `AED ${(feeFils / 100).toFixed(0)} needed, AED ${(input.walletBalanceFils / 100).toFixed(0)} available. Top up?`,
      { neededFils: feeFils, availableFils: input.walletBalanceFils },
    );
  }

  return { ok: true };
}
