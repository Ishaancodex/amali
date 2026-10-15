/**
 * `validateBooking` (PRD §7): the single function every booking attempt
 * goes through, resident-initiated or system (waitlist promotion, agent
 * on-behalf). Checks run in the PRD's exact order; the first failure wins.
 * Pure — the caller (a command handler) assembles this input from the
 * store; nothing here touches `AppState` or React.
 */
import {
  addDaysIso,
  addHoursIso,
  dubaiDateKey,
  dubaiDateTimeToIso,
  fmtDate,
  fmtTime,
  isAtOrBeforeIso,
} from '@/lib/time';
import { rules } from '@/config/rules';
import { reject, ALTERNATIVES_ELIGIBLE, type RuleRejection } from '@/domain/rules/errors';
import { effectiveHoursForDate } from './hours';
import { slotEnd, slotsOverlap } from './slots';
import { quotaCountingBookings, computeQuotaUsage, quotaWouldExceed } from './quota';
import { findAlternatives } from './alternatives';
import type {
  AmenityKey,
  AmenityStatus,
  Blackout,
  WeeklyHours,
  HoursException,
} from '@/types/amenity';
import type { Booking, BookingPlayer, Suspension } from '@/types/booking';
import type { Unit } from '@/types/community';

export interface ValidateBookingInput {
  now: string;
  amenity: AmenityKey;
  start: string;
  durationMinutes: number;
  unit: Unit;
  bookerId: string;
  /** Guests and tagged residents, not including the booker. */
  players: BookingPlayer[];
  amenityStatus: AmenityStatus;
  blackouts: readonly Blackout[];
  weeklyHours: readonly WeeklyHours[];
  hoursExceptions: readonly HoursException[];
  /** Every booking at this amenity that could conflict — the caller doesn't need to pre-filter by date. */
  amenityBookings: readonly Booking[];
  /** The unit's own padel bookings, for quota (any state — `quotaCountingBookings` filters). */
  unitBookings: readonly Booking[];
  suspension?: Suspension;
  walletBalanceFils: number;
  /**
   * Skips check 5 (lead time). Set only by `waitlist.accept`: PRD §8.1's offer windows are
   * deliberately allowed to run inside the normal 2-hour lead time (down to
   * `minMinutesBeforeStartForOffer`, or right up to start under open release), so re-applying the
   * fresh-booking lead-time rule at acceptance would make a just-issued, still-open offer
   * unacceptable.
   */
  bypassLeadTime?: boolean;
}

export type ValidateBookingResult = { ok: true } | RuleRejection;

export function validateBooking(input: ValidateBookingInput): ValidateBookingResult {
  const { now, amenity, start, durationMinutes, unit, bookerId } = input;
  const end = slotEnd(start, durationMinutes);
  const guests = input.players.filter((p) => p.guestName);
  const totalPlayers = 1 + input.players.length;

  // 1 — eligibility
  if (unit.amenityRightsHolderId !== bookerId) {
    return reject('NOT_ELIGIBLE', `Amenity access for ${unit.id} is with the current tenant.`, {
      unitId: unit.id,
    });
  }
  if (unit.accessSuspended) {
    return reject('NOT_ELIGIBLE', 'Unit access is suspended. Contact the community manager.');
  }
  if (input.suspension) {
    return reject('SUSPENDED', `Padel booking suspended until ${fmtDate(input.suspension.to)}.`, {
      until: input.suspension.to,
    });
  }

  // 2 — amenity status / blackout
  const overlappingBlackout = input.blackouts.find((b) => slotsOverlap(start, end, b.start, b.end));
  if (overlappingBlackout) {
    return reject(
      'BLACKOUT',
      `The court is closed for ${overlappingBlackout.reason} ${fmtDate(overlappingBlackout.start)}–${fmtDate(overlappingBlackout.end)}.`,
      { reason: overlappingBlackout.reason },
    );
  }
  if (input.amenityStatus !== 'open') {
    return reject('AMENITY_CLOSED', 'Padel is currently closed.', { status: input.amenityStatus });
  }

  // 3 — operating hours (after date exceptions)
  const dateKey = dubaiDateKey(start);
  const hours = effectiveHoursForDate(input.weeklyHours, input.hoursExceptions, amenity, dateKey);
  if (!hours || start < hours.open || end > hours.close) {
    const openLabel = hours ? fmtTime(hours.open) : rules.padel.operatingHours.open;
    return reject('OUTSIDE_HOURS', `Padel opens at ${openLabel}.`, { open: openLabel });
  }

  // 4 — booking window: a rolling `bookingWindowDays`-day window (today inclusive) that gains
  // its farthest day each morning at `bookingWindowOpensAt` — before that time today, the
  // window is one day shorter (PRD §8.1: "7 days are enabled and day 8 shows 'Opens tomorrow
  // 08:00'"). Equivalently, date D opens the instant (D - (bookingWindowDays - 1)) reaches
  // `bookingWindowOpensAt`.
  const todayKey = dubaiDateKey(now);
  const windowEndOffset =
    rules.padel.bookingWindowDays - (fmtTime(now) >= rules.padel.bookingWindowOpensAt ? 1 : 2);
  const windowEndKey = dubaiDateKey(addHoursIso(now, 24 * windowEndOffset));
  if (dateKey < todayKey || dateKey > windowEndKey) {
    const opensAt = dubaiDateTimeToIso(
      dubaiDateKey(addDaysIso(start, -(rules.padel.bookingWindowDays - 1))),
      rules.padel.bookingWindowOpensAt,
    );
    const opensWhen =
      dubaiDateKey(opensAt) === todayKey
        ? 'today'
        : dubaiDateKey(opensAt) === dubaiDateKey(addDaysIso(now, 1))
          ? 'tomorrow'
          : fmtDate(opensAt);
    return reject(
      'WINDOW_NOT_OPEN',
      `Bookings for ${fmtDate(start)} open ${opensWhen} at ${rules.padel.bookingWindowOpensAt}.`,
      { date: dateKey },
    );
  }

  // 5 — lead time
  if (
    !input.bypassLeadTime &&
    !isAtOrBeforeIso(addHoursIso(now, rules.padel.leadTimeHours), start)
  ) {
    return reject('LEAD_TIME', `Book at least ${rules.padel.leadTimeHours} hours ahead.`, {
      hours: rules.padel.leadTimeHours,
    });
  }

  // 6 — duration and start-time grid. Slicing the UTC ISO string's minute digits directly
  // (rather than converting to Dubai local time) is safe only because Dubai's UTC+4 offset is a
  // whole number of hours with no DST — the minute value is identical in both zones.
  const startMinute = Number(start.slice(14, 16));
  const onGrid = startMinute % rules.padel.slotGridMinutes === 0 && start.slice(17, 19) === '00';
  if (!onGrid || !(rules.padel.durationsMinutes as readonly number[]).includes(durationMinutes)) {
    return reject(
      'INVALID_DURATION',
      `Choose ${rules.padel.durationsMinutes.join(' or ')} minutes.`,
      {
        durations: rules.padel.durationsMinutes.join('/'),
      },
    );
  }

  // 7 — capacity / conflict. There's no separate hold-entity table: `booking.hold` creates the
  // Booking itself in state 'held' (TRD-sound, since dispatch() runs the whole check-then-write
  // atomically inside one `set()` — there's no window for a second hold to slip in between), so a
  // 'held' Booking by someone else is exactly PRD §7's "someone is completing this booking"; a
  // 'held' Booking by the SAME resident is them resuming their own in-progress hold, not a conflict.
  const conflictingBooking = input.amenityBookings.find(
    (b) =>
      (b.state === 'confirmed' || b.state === 'checked_in') &&
      slotsOverlap(start, end, b.start, b.end),
  );
  if (conflictingBooking) {
    return reject('SLOT_FULL', 'Someone already has this slot.');
  }
  const conflictingHold = input.amenityBookings.find(
    (b) =>
      b.state === 'held' && b.bookerId !== bookerId && slotsOverlap(start, end, b.start, b.end),
  );
  if (conflictingHold) {
    return reject('SLOT_HELD', 'Someone is completing this booking. Join the waitlist?');
  }

  // 8 — quota / fair use (counted per unit)
  const unitQuotaBookings = quotaCountingBookings(input.unitBookings, now);
  const usage = computeQuotaUsage(unitQuotaBookings);
  if (quotaWouldExceed(usage, start)) {
    return reject(
      'QUOTA_EXCEEDED',
      `Your unit has used ${usage.total} of ${rules.padel.quota.maxBookings} padel bookings this week.`,
      { used: usage.total, max: rules.padel.quota.maxBookings },
    );
  }

  // 9 — age / audience restrictions (padel has none today; kept for engine symmetry with other amenities)

  // 10 — guest allowance / party size
  if (guests.length > rules.padel.maxGuestsPerBooking) {
    return reject('GUEST_LIMIT', `Up to ${rules.padel.maxGuestsPerBooking} guests per booking.`, {
      max: rules.padel.maxGuestsPerBooking,
    });
  }
  if (totalPlayers > rules.padel.maxPlayersTotal) {
    return reject('GUEST_LIMIT', `Up to ${rules.padel.maxPlayersTotal} players per booking.`, {
      max: rules.padel.maxPlayersTotal,
    });
  }

  // 11 — wallet balance covers guest charges
  const guestFeeFils = guests.length * rules.padel.guestFeeFils;
  if (guestFeeFils > input.walletBalanceFils) {
    return reject(
      'INSUFFICIENT_BALANCE',
      `AED ${(guestFeeFils / 100).toFixed(0)} needed, AED ${(input.walletBalanceFils / 100).toFixed(0)} available. Top up?`,
      { neededFils: guestFeeFils, availableFils: input.walletBalanceFils },
    );
  }

  return { ok: true };
}

/** Wraps `validateBooking` and, on an alternatives-eligible failure, fills in up to 3 nearby valid starts. */
export function validateBookingWithAlternatives(
  input: ValidateBookingInput,
): ValidateBookingResult {
  const result = validateBooking(input);
  if (result.ok || !ALTERNATIVES_ELIGIBLE.includes(result.code)) return result;

  const alternatives = findAlternatives(
    input.start,
    (candidateStart) => validateBooking({ ...input, start: candidateStart }).ok,
  );
  return { ...result, alternatives };
}
