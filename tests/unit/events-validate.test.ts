import { describe, it, expect } from 'vitest';
import {
  validateRsvp,
  type ValidateRsvpInput,
  type ValidateRsvpAttendee,
} from '@/domain/events/validate';
import type { ProgrammeEvent, Showtime, Rsvp } from '@/types/event';

const NOW = '2026-10-20T10:00:00.000Z';

function baseEvent(overrides: Partial<ProgrammeEvent> = {}): ProgrammeEvent {
  return {
    id: 'evt_1',
    createdAt: NOW,
    updatedAt: NOW,
    title: 'Family Movie Night',
    venue: 'screening',
    type: 'movie',
    poster: '',
    description: '',
    ageRating: 'PG',
    durationMins: 120,
    pricing: { resident: 0, household: 0, guest_adult: 2500, guest_child: 1500 },
    lifecycle: 'published',
    ...overrides,
  };
}

function baseShowtime(overrides: Partial<Showtime> = {}): Showtime {
  return {
    id: 'show_1',
    createdAt: NOW,
    updatedAt: NOW,
    eventId: 'evt_1',
    start: '2026-10-21T15:00:00.000Z',
    end: '2026-10-21T17:00:00.000Z',
    capacityMode: 'seats',
    capacity: 22,
    blockedSeats: [],
    regOpens: '2026-10-14T00:00:00.000Z',
    regCloses: '2026-10-21T14:30:00.000Z',
    state: 'open',
    ...overrides,
  };
}

function rsvp(overrides: Partial<Rsvp> = {}): Rsvp {
  return {
    id: 'rsvp_other',
    createdAt: NOW,
    updatedAt: NOW,
    showtimeId: 'show_1',
    unitId: 'W-1',
    bookerId: 'res_other',
    attendees: [],
    charges: [],
    state: 'confirmed',
    ...overrides,
  };
}

function baseInput(overrides: Partial<ValidateRsvpInput> = {}): ValidateRsvpInput {
  const attendees: ValidateRsvpAttendee[] = [{ category: 'resident', seat: 'A1' }];
  return {
    now: NOW,
    event: baseEvent(),
    showtime: baseShowtime(),
    attendees,
    showtimeRsvps: [],
    walletBalanceFils: 1_000_000,
    ...overrides,
  };
}

describe('validateRsvp — happy path', () => {
  it('passes a fully valid single-seat RSVP', () => {
    expect(validateRsvp(baseInput())).toEqual({ ok: true });
  });

  it('passes a headcount-mode (Music Room) RSVP with no seats', () => {
    const result = validateRsvp(
      baseInput({
        event: baseEvent({ venue: 'music' }),
        showtime: baseShowtime({ capacityMode: 'headcount', capacity: 12 }),
        attendees: [{ category: 'resident' }],
      }),
    );
    expect(result).toEqual({ ok: true });
  });
});

describe('validateRsvp — each RuleCode', () => {
  it('REGISTRATION_CLOSED — showtime cancelled', () => {
    const result = validateRsvp(baseInput({ showtime: baseShowtime({ state: 'cancelled' }) }));
    expect(result).toMatchObject({ ok: false, code: 'REGISTRATION_CLOSED' });
  });

  it('REGISTRATION_CLOSED — inside the 30-minute pre-showtime cutoff', () => {
    const result = validateRsvp(baseInput({ now: '2026-10-21T14:45:00.000Z' }));
    expect(result).toMatchObject({ ok: false, code: 'REGISTRATION_CLOSED' });
  });

  it('REGISTRATION_CLOSED — before registration opens', () => {
    const result = validateRsvp(baseInput({ now: '2026-10-01T00:00:00.000Z' }));
    expect(result).toMatchObject({ ok: false, code: 'REGISTRATION_CLOSED' });
  });

  it('AGE_RESTRICTED — a child guest at a PG-13 event', () => {
    const result = validateRsvp(
      baseInput({
        event: baseEvent({ ageRating: 'PG-13' }),
        attendees: [
          { category: 'resident', seat: 'A1' },
          { category: 'guest_child', seat: 'A2' },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'AGE_RESTRICTED' });
  });

  it('AGE_RESTRICTED — a child guest at an 18+ event', () => {
    const result = validateRsvp(
      baseInput({
        event: baseEvent({ ageRating: '18+' }),
        attendees: [
          { category: 'resident', seat: 'A1' },
          { category: 'guest_child', seat: 'A2' },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'AGE_RESTRICTED' });
  });

  it('a child guest at a plain PG event is fine', () => {
    const result = validateRsvp(
      baseInput({
        attendees: [
          { category: 'resident', seat: 'A1' },
          { category: 'guest_child', seat: 'A2' },
        ],
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it('GUEST_LIMIT — more than 2 guests', () => {
    const result = validateRsvp(
      baseInput({
        attendees: [
          { category: 'resident', seat: 'A1' },
          { category: 'guest_adult', seat: 'A2' },
          { category: 'guest_adult', seat: 'A3' },
          { category: 'guest_child', seat: 'A4' },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'GUEST_LIMIT' });
  });

  it('SHOWTIME_FULL — not enough capacity even among confirmed RSVPs', () => {
    const full = rsvp({
      attendees: Array.from({ length: 22 }, (_, i) => ({
        id: `a${i}`,
        name: 'x',
        category: 'resident' as const,
        seat: `A${i}`,
      })),
    });
    const result = validateRsvp(baseInput({ showtimeRsvps: [full] }));
    expect(result).toMatchObject({ ok: false, code: 'SHOWTIME_FULL' });
  });

  it('SHOWTIME_HELD — fits among confirmed, but someone else is mid-checkout', () => {
    const held = rsvp({
      id: 'rsvp_held',
      state: 'held',
      attendees: Array.from({ length: 22 }, (_, i) => ({
        id: `a${i}`,
        name: 'x',
        category: 'resident' as const,
        seat: `A${i}`,
      })),
    });
    const result = validateRsvp(baseInput({ showtimeRsvps: [held] }));
    expect(result).toMatchObject({ ok: false, code: 'SHOWTIME_HELD' });
  });

  it('SEAT_COUNT_MISMATCH — fewer seats than attendees', () => {
    const result = validateRsvp(
      baseInput({
        attendees: [{ category: 'resident', seat: 'A1' }, { category: 'guest_adult' }],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'SEAT_COUNT_MISMATCH' });
  });

  it('SEAT_COUNT_MISMATCH — two attendees choose the same seat', () => {
    const result = validateRsvp(
      baseInput({
        attendees: [
          { category: 'resident', seat: 'A1' },
          { category: 'guest_adult', seat: 'A1' },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'SEAT_COUNT_MISMATCH' });
  });

  it('SEAT_TAKEN — a blocked seat', () => {
    const result = validateRsvp(baseInput({ showtime: baseShowtime({ blockedSeats: ['A1'] }) }));
    expect(result).toMatchObject({ ok: false, code: 'SEAT_TAKEN' });
  });

  it('SEAT_TAKEN — a seat already confirmed by someone else', () => {
    const taken = rsvp({ attendees: [{ id: 'a1', name: 'x', category: 'resident', seat: 'A1' }] });
    const result = validateRsvp(baseInput({ showtimeRsvps: [taken] }));
    expect(result).toMatchObject({ ok: false, code: 'SEAT_TAKEN' });
  });

  it('SHOWTIME_HELD — a seat someone else is holding mid-checkout', () => {
    const held = rsvp({
      id: 'rsvp_held',
      state: 'held',
      attendees: [{ id: 'a1', name: 'x', category: 'resident', seat: 'A1' }],
    });
    const result = validateRsvp(baseInput({ showtimeRsvps: [held] }));
    expect(result).toMatchObject({ ok: false, code: 'SHOWTIME_HELD' });
  });

  it('passes — a hold by the same RSVP (excludeRsvpId) does not conflict with itself', () => {
    const own = rsvp({
      id: 'rsvp_mine',
      state: 'held',
      attendees: [{ id: 'a1', name: 'x', category: 'resident', seat: 'A1' }],
    });
    const result = validateRsvp(baseInput({ showtimeRsvps: [own], excludeRsvpId: 'rsvp_mine' }));
    expect(result).toEqual({ ok: true });
  });

  it('INSUFFICIENT_BALANCE — wallet cannot cover the guest fee', () => {
    const result = validateRsvp(
      baseInput({
        attendees: [
          { category: 'resident', seat: 'A1' },
          { category: 'guest_adult', seat: 'A2' },
        ],
        walletBalanceFils: 1000,
      }),
    );
    expect(result).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE' });
  });
});

describe('validateRsvp — check order (first failure wins)', () => {
  it('registration-closed (1) beats a full showtime (4)', () => {
    const full = rsvp({
      attendees: Array.from({ length: 22 }, (_, i) => ({
        id: `a${i}`,
        name: 'x',
        category: 'resident' as const,
        seat: `A${i}`,
      })),
    });
    const result = validateRsvp(
      baseInput({ showtime: baseShowtime({ state: 'cancelled' }), showtimeRsvps: [full] }),
    );
    expect(result).toMatchObject({ code: 'REGISTRATION_CLOSED' });
  });

  it('age restriction (2) beats the guest limit (3) when both are true', () => {
    const result = validateRsvp(
      baseInput({
        event: baseEvent({ ageRating: '18+' }),
        attendees: [
          { category: 'resident', seat: 'A1' },
          { category: 'guest_adult', seat: 'A2' },
          { category: 'guest_child', seat: 'A3' },
        ],
      }),
    );
    expect(result).toMatchObject({ code: 'AGE_RESTRICTED' });
  });

  it('capacity (4) beats wallet balance (6) when both are true', () => {
    const full = rsvp({
      attendees: Array.from({ length: 22 }, (_, i) => ({
        id: `a${i}`,
        name: 'x',
        category: 'resident' as const,
        seat: `A${i}`,
      })),
    });
    const result = validateRsvp(
      baseInput({
        showtimeRsvps: [full],
        walletBalanceFils: 0,
        attendees: [{ category: 'guest_adult', seat: 'B1' }],
      }),
    );
    expect(result).toMatchObject({ code: 'SHOWTIME_FULL' });
  });
});
