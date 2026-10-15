import { describe, it, expect } from 'vitest';
import {
  validateBooking,
  validateBookingWithAlternatives,
  type ValidateBookingInput,
} from '@/domain/booking/validate';
import { rules } from '@/config/rules';
import type { WeeklyHours } from '@/types/amenity';
import type { Booking, Suspension } from '@/types/booking';
import type { Unit } from '@/types/community';

const NOW = '2026-10-14T13:30:00.000Z'; // Wed 14 Oct, 17:30 Dubai — PRD S1's start instant.
const VALID_START = '2026-10-15T10:00:00.000Z'; // Thu 14:00 Dubai — on-grid, within hours, >2h lead, in window.

function weeklyHoursAllDays(): WeeklyHours[] {
  return Array.from({ length: 7 }, (_, day) => ({
    amenity: 'padel' as const,
    day: day as WeeklyHours['day'],
    open: rules.padel.operatingHours.open,
    close: rules.padel.operatingHours.close,
  }));
}

function baseUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'W-2203',
    kind: 'apartment',
    amenityRightsHolderId: 'res_booker',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ValidateBookingInput> = {}): ValidateBookingInput {
  return {
    now: NOW,
    amenity: 'padel',
    start: VALID_START,
    durationMinutes: 60,
    unit: baseUnit(),
    bookerId: 'res_booker',
    players: [],
    amenityStatus: 'open',
    blackouts: [],
    weeklyHours: weeklyHoursAllDays(),
    hoursExceptions: [],
    amenityBookings: [],
    unitBookings: [],
    suspension: undefined,
    walletBalanceFils: 1_000_000,
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_existing',
    createdAt: NOW,
    updatedAt: NOW,
    amenity: 'padel',
    unitId: 'W-2203',
    bookerId: 'res_other',
    start: VALID_START,
    end: '2026-10-15T11:00:00.000Z',
    players: [],
    charges: [],
    state: 'confirmed',
    history: [],
    source: 'resident',
    countsTowardQuota: true,
    ...overrides,
  };
}

describe('validateBooking — the happy path', () => {
  it('passes a fully valid request', () => {
    expect(validateBooking(baseInput())).toEqual({ ok: true });
  });
});

describe('validateBooking — each RuleCode, in isolation', () => {
  it('1 NOT_ELIGIBLE — unit amenity rights held by someone else', () => {
    const result = validateBooking(
      baseInput({ unit: baseUnit({ amenityRightsHolderId: 'res_tenant' }) }),
    );
    expect(result).toMatchObject({ ok: false, code: 'NOT_ELIGIBLE' });
  });

  it('1 NOT_ELIGIBLE — unit access suspended', () => {
    const result = validateBooking(
      baseInput({ unit: baseUnit({ accessSuspended: { reason: 'dues', since: NOW } }) }),
    );
    expect(result).toMatchObject({ ok: false, code: 'NOT_ELIGIBLE' });
  });

  it('1 SUSPENDED — an active padel suspension', () => {
    const suspension: Suspension = {
      id: 'susp_1',
      createdAt: NOW,
      updatedAt: NOW,
      residentId: 'res_booker',
      amenity: 'padel',
      from: '2026-10-14T00:00:00.000Z',
      to: '2026-10-21T00:00:00.000Z',
    };
    const result = validateBooking(baseInput({ suspension }));
    expect(result).toMatchObject({ ok: false, code: 'SUSPENDED' });
    expect((result as { message: string }).message).toContain('21 Oct');
  });

  it('2 BLACKOUT — an overlapping blackout', () => {
    const result = validateBooking(
      baseInput({
        blackouts: [
          {
            id: 'bl_1',
            createdAt: NOW,
            updatedAt: NOW,
            amenity: 'padel',
            start: '2026-10-15T00:00:00.000Z',
            end: '2026-10-16T00:00:00.000Z',
            reason: 'resurfacing',
            source: 'maintenance',
            handling: 'cancel_priority_rebook',
            createdBy: 'staff_victor',
          },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'BLACKOUT' });
  });

  it('2 AMENITY_CLOSED — status not open, no blackout', () => {
    const result = validateBooking(baseInput({ amenityStatus: 'maintenance' }));
    expect(result).toMatchObject({ ok: false, code: 'AMENITY_CLOSED' });
  });

  it('3 OUTSIDE_HOURS — before opening', () => {
    const result = validateBooking(
      baseInput({ start: '2026-10-15T01:00:00.000Z' /* 05:00 Dubai */ }),
    );
    expect(result).toMatchObject({ ok: false, code: 'OUTSIDE_HOURS' });
  });

  it('3 OUTSIDE_HOURS — the booking would run past closing', () => {
    // 22:30 Dubai + 90 min would end 00:00 next day, past the 23:00 close.
    const result = validateBooking(
      baseInput({ start: '2026-10-15T18:30:00.000Z', durationMinutes: 90 }),
    );
    expect(result).toMatchObject({ ok: false, code: 'OUTSIDE_HOURS' });
  });

  it('4 WINDOW_NOT_OPEN — more than the rolling window ahead', () => {
    const result = validateBooking(baseInput({ start: '2026-10-25T10:00:00.000Z' }));
    expect(result).toMatchObject({ ok: false, code: 'WINDOW_NOT_OPEN' });
  });

  it('5 LEAD_TIME — inside the 2-hour minimum', () => {
    const result = validateBooking(baseInput({ start: '2026-10-14T14:00:00.000Z' })); // 30 min after NOW
    expect(result).toMatchObject({ ok: false, code: 'LEAD_TIME' });
  });

  it('5 bypassLeadTime skips the check (waitlist.accept only)', () => {
    const result = validateBooking(
      baseInput({ start: '2026-10-14T14:00:00.000Z', bypassLeadTime: true }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('6 INVALID_DURATION — an off-grid start', () => {
    const result = validateBooking(baseInput({ start: '2026-10-15T10:15:00.000Z' }));
    expect(result).toMatchObject({ ok: false, code: 'INVALID_DURATION' });
  });

  it('6 INVALID_DURATION — a duration that is not 60 or 90', () => {
    const result = validateBooking(baseInput({ durationMinutes: 45 }));
    expect(result).toMatchObject({ ok: false, code: 'INVALID_DURATION' });
  });

  it('7 SLOT_FULL — an overlapping confirmed booking', () => {
    const result = validateBooking(baseInput({ amenityBookings: [booking()] }));
    expect(result).toMatchObject({ ok: false, code: 'SLOT_FULL' });
  });

  it('7 SLOT_HELD — someone else is mid-hold on this slot (a Booking still in state "held")', () => {
    const result = validateBooking(baseInput({ amenityBookings: [booking({ state: 'held' })] }));
    expect(result).toMatchObject({ ok: false, code: 'SLOT_HELD' });
  });

  it('7 passes — resuming your own hold does not conflict with itself', () => {
    expect(
      validateBooking(
        baseInput({ amenityBookings: [booking({ state: 'held', bookerId: 'res_booker' })] }),
      ),
    ).toEqual({ ok: true });
  });

  it('8 QUOTA_EXCEEDED — the unit has already used its 3 bookings this week', () => {
    const unitBookings = [
      booking({
        id: 'bk_1',
        unitId: 'W-2203',
        start: '2026-10-12T15:00:00.000Z',
        end: '2026-10-12T16:00:00.000Z',
      }),
      booking({
        id: 'bk_2',
        unitId: 'W-2203',
        start: '2026-10-13T15:00:00.000Z',
        end: '2026-10-13T16:00:00.000Z',
      }),
      booking({
        id: 'bk_3',
        unitId: 'W-2203',
        start: '2026-10-13T16:00:00.000Z',
        end: '2026-10-13T17:00:00.000Z',
      }),
    ];
    const result = validateBooking(baseInput({ unitBookings }));
    expect(result).toMatchObject({ ok: false, code: 'QUOTA_EXCEEDED' });
  });

  it('8 QUOTA_EXCEEDED — the peak-hours sub-limit (2 of 2 already used)', () => {
    const peak = (id: string, start: string, end: string) =>
      booking({ id, unitId: 'W-2203', start, end });
    const unitBookings = [
      peak('bk_1', '2026-10-12T15:00:00.000Z', '2026-10-12T16:00:00.000Z'), // 19:00 Dubai, peak
      peak('bk_2', '2026-10-13T16:00:00.000Z', '2026-10-13T17:00:00.000Z'), // 20:00 Dubai, peak
    ];
    // VALID_START is 14:00 Dubai (not peak) — swap to a peak candidate start to hit the sub-limit.
    const result = validateBooking(
      baseInput({ start: '2026-10-15T15:00:00.000Z' /* 19:00 Dubai */, unitBookings }),
    );
    expect(result).toMatchObject({ ok: false, code: 'QUOTA_EXCEEDED' });
  });

  it('10 GUEST_LIMIT — more than 2 guests', () => {
    const result = validateBooking(
      baseInput({
        players: [
          { guestName: 'A', guestPhone: '1' },
          { guestName: 'B', guestPhone: '2' },
          { guestName: 'C', guestPhone: '3' },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'GUEST_LIMIT' });
  });

  it('10 GUEST_LIMIT — more than 4 total players', () => {
    const result = validateBooking(
      baseInput({
        players: [
          { residentId: 'res_a' },
          { residentId: 'res_b' },
          { residentId: 'res_c' },
          { residentId: 'res_d' },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'GUEST_LIMIT' });
  });

  it('11 INSUFFICIENT_BALANCE — wallet cannot cover the guest fee', () => {
    const result = validateBooking(
      baseInput({ players: [{ guestName: 'A', guestPhone: '1' }], walletBalanceFils: 1000 }),
    );
    expect(result).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE' });
  });
});

describe('validateBooking — check order (first failure wins)', () => {
  it('eligibility (1) beats a slot conflict (7) when both are true', () => {
    const result = validateBooking(
      baseInput({
        unit: baseUnit({ amenityRightsHolderId: 'res_someone_else' }),
        amenityBookings: [booking()],
      }),
    );
    expect(result).toMatchObject({ code: 'NOT_ELIGIBLE' });
  });

  it('a blackout (2) beats lead time (5) when both are true', () => {
    const result = validateBooking(
      baseInput({
        start: '2026-10-14T14:00:00.000Z', // inside lead time too
        blackouts: [
          {
            id: 'bl_1',
            createdAt: NOW,
            updatedAt: NOW,
            amenity: 'padel',
            start: '2026-10-14T00:00:00.000Z',
            end: '2026-10-16T00:00:00.000Z',
            reason: 'resurfacing',
            source: 'maintenance',
            handling: 'cancel_priority_rebook',
            createdBy: 'staff_victor',
          },
        ],
      }),
    );
    expect(result).toMatchObject({ code: 'BLACKOUT' });
  });

  it('a slot conflict (7) beats quota (8) when both are true', () => {
    const unitBookings = [
      booking({
        id: 'bk_1',
        unitId: 'W-2203',
        start: '2026-10-12T15:00:00.000Z',
        end: '2026-10-12T16:00:00.000Z',
      }),
      booking({
        id: 'bk_2',
        unitId: 'W-2203',
        start: '2026-10-13T15:00:00.000Z',
        end: '2026-10-13T16:00:00.000Z',
      }),
      booking({
        id: 'bk_3',
        unitId: 'W-2203',
        start: '2026-10-13T16:00:00.000Z',
        end: '2026-10-13T17:00:00.000Z',
      }),
    ];
    const result = validateBooking(baseInput({ amenityBookings: [booking()], unitBookings }));
    expect(result).toMatchObject({ code: 'SLOT_FULL' });
  });
});

describe('validateBookingWithAlternatives', () => {
  it('fills in up to 3 nearby valid starts on an alternatives-eligible failure', () => {
    const result = validateBookingWithAlternatives(baseInput({ amenityBookings: [booking()] }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.code).toBe('SLOT_FULL');
    expect(result.alternatives?.length).toBeGreaterThan(0);
    expect(result.alternatives?.length).toBeLessThanOrEqual(3);
    expect(result.alternatives).not.toContain(VALID_START);
  });

  it('does not attach alternatives for a non-eligible code (e.g. NOT_ELIGIBLE)', () => {
    const result = validateBookingWithAlternatives(
      baseInput({ unit: baseUnit({ amenityRightsHolderId: 'res_other' }) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.alternatives).toBeUndefined();
  });
});
