import { describe, it, expect } from 'vitest';
import {
  occupiedAttendeeCount,
  confirmedAttendeeCount,
  remainingCapacity,
} from '@/domain/events/capacity';
import { allSeatIds, confirmedSeats, heldSeats } from '@/domain/events/seats';
import { partyFeeFils } from '@/domain/events/pricing';
import { findNextFittingParty } from '@/domain/events/waitlist';
import type { Rsvp } from '@/types/event';
import type { WaitlistEntry } from '@/types/booking';

const NOW = '2026-10-20T10:00:00.000Z';

function rsvp(overrides: Partial<Rsvp> = {}): Rsvp {
  return {
    id: 'rsvp_1',
    createdAt: NOW,
    updatedAt: NOW,
    showtimeId: 'show_1',
    unitId: 'W-1',
    bookerId: 'res_1',
    attendees: [],
    charges: [],
    state: 'confirmed',
    ...overrides,
  };
}

describe('domain/events/capacity', () => {
  it('occupiedAttendeeCount sums held + confirmed, excluding cancelled and a given id', () => {
    const r1 = rsvp({
      id: 'a',
      state: 'confirmed',
      attendees: [{ id: '1', name: 'x', category: 'resident' }],
    });
    const r2 = rsvp({
      id: 'b',
      state: 'held',
      attendees: [
        { id: '2', name: 'y', category: 'guest_adult' },
        { id: '3', name: 'z', category: 'guest_adult' },
      ],
    });
    const r3 = rsvp({
      id: 'c',
      state: 'cancelled',
      attendees: [{ id: '4', name: 'w', category: 'resident' }],
    });
    expect(occupiedAttendeeCount([r1, r2, r3])).toBe(3);
    expect(occupiedAttendeeCount([r1, r2, r3], 'b')).toBe(1);
  });

  it('confirmedAttendeeCount only counts confirmed', () => {
    const r1 = rsvp({
      state: 'confirmed',
      attendees: [{ id: '1', name: 'x', category: 'resident' }],
    });
    const r2 = rsvp({ state: 'held', attendees: [{ id: '2', name: 'y', category: 'resident' }] });
    expect(confirmedAttendeeCount([r1, r2])).toBe(1);
  });

  it('remainingCapacity subtracts blocked seats and occupancy, never below 0', () => {
    expect(remainingCapacity(22, ['A1', 'A2'], 15)).toBe(5);
    expect(remainingCapacity(22, [], 30)).toBe(0);
  });
});

describe('domain/events/seats', () => {
  it('allSeatIds produces A1-D5 plus the 2 accessible spaces (22 total)', () => {
    const seats = allSeatIds();
    expect(seats).toHaveLength(22);
    expect(seats).toContain('A1');
    expect(seats).toContain('D5');
    expect(seats).toContain('AC1');
    expect(seats).toContain('AC2');
  });

  it('confirmedSeats and heldSeats partition by RSVP state', () => {
    const confirmed = rsvp({
      id: 'a',
      state: 'confirmed',
      attendees: [{ id: '1', name: 'x', category: 'resident', seat: 'A1' }],
    });
    const held = rsvp({
      id: 'b',
      state: 'held',
      attendees: [{ id: '2', name: 'y', category: 'resident', seat: 'B1' }],
    });
    expect(confirmedSeats([confirmed, held])).toEqual(new Set(['A1']));
    expect(heldSeats([confirmed, held])).toEqual(new Set(['B1']));
    expect(heldSeats([confirmed, held], 'b')).toEqual(new Set());
  });
});

describe('domain/events/pricing', () => {
  const pricing = { resident: 0, household: 0, guest_adult: 2500, guest_child: 1500 };

  it('sums guest fees, residents and household free', () => {
    const fee = partyFeeFils(
      [
        { category: 'resident' },
        { category: 'household' },
        { category: 'guest_adult' },
        { category: 'guest_child' },
      ],
      pricing,
    );
    expect(fee).toBe(4000);
  });
});

describe('domain/events/waitlist — party-size fitting', () => {
  function entry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
    return {
      id: 'wl_1',
      createdAt: NOW,
      updatedAt: NOW,
      resourceKey: 'showtime:show_1',
      residentId: 'res_1',
      partySize: 1,
      position: 1,
      state: 'waiting',
      ...overrides,
    };
  }

  it('offers to the next party that fits, skipping ones that are too big', () => {
    const party4 = entry({ id: 'p4', position: 1, partySize: 4 });
    const party2 = entry({ id: 'p2', position: 2, partySize: 2 });
    // Only 2 seats free — party4 (#1) doesn't fit, party2 (#2) does.
    expect(findNextFittingParty([party4, party2], 2)?.id).toBe('p2');
  });

  it('keeps #1 in the queue (does not remove or skip-permanently) — a later call with more capacity offers to #1 again', () => {
    const party4 = entry({ id: 'p4', position: 1, partySize: 4 });
    const party2 = entry({ id: 'p2', position: 2, partySize: 2 });
    expect(findNextFittingParty([party4, party2], 2)?.id).toBe('p2');
    expect(findNextFittingParty([party4, party2], 4)?.id).toBe('p4');
  });

  it('ignores non-waiting entries', () => {
    const offered = entry({ id: 'o1', state: 'offered', partySize: 1 });
    expect(findNextFittingParty([offered], 5)).toBeUndefined();
  });
});
