import { describe, it, expect } from 'vitest';
import { rules } from '@/config/rules';
import { ageOnDate, bandForAge, bandForChild } from '@/domain/creche/bands';
import {
  bandCapacity,
  bandLoad,
  countActiveInWindow,
  planRebalance,
  staffOnBand,
} from '@/domain/creche/capacity';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { lateFeeFils, lateMinutes, sessionFeeFils } from '@/domain/creche/fees';
import { validateCheckIn, validateCrecheBooking } from '@/domain/creche/validate';
import type { BandAssignment, Child, CrecheBooking, CrecheSession, Guardian } from '@/types/creche';
import type { Shift } from '@/types/ops';

const bands = rules.creche.bands;
const T = '2026-10-14T00:00:00.000Z';

const child: Child = {
  id: 'c1',
  createdAt: T,
  updatedAt: T,
  unitId: 'E-1804',
  name: 'Omar',
  dob: '2022-03-10',
  photo: 'OM',
  photoConsent: true,
  guardianIds: ['g1', 'g2'],
  emergencyContact: { name: 'Layla', phone: '1' },
};
const guardian = (over: Partial<Guardian> = {}): Guardian => ({
  id: 'g1',
  createdAt: T,
  updatedAt: T,
  childIds: ['c1'],
  name: 'Layla',
  relation: 'Mother',
  phone: '1',
  photo: 'LA',
  idLast4: '1234',
  approval: 'approved',
  ...over,
});
const booking = (
  id: string,
  state: CrecheBooking['state'],
  createdAt: string,
  band: CrecheBooking['band'] = 'kids',
): CrecheBooking => ({
  id,
  createdAt,
  updatedAt: createdAt,
  sessionId: 's1',
  childId: id,
  bookedBy: 'r',
  band,
  state,
});
const session: CrecheSession = {
  id: 's1',
  createdAt: T,
  updatedAt: T,
  date: '2026-10-14',
  start: '2026-10-14T05:00:00.000Z',
  end: '2026-10-14T08:00:00.000Z',
  kind: 'morning',
};

describe('age bands', () => {
  it('counts whole years, birthday-aware', () => {
    expect(ageOnDate('2022-03-10', '2026-03-09')).toBe(3);
    expect(ageOnDate('2022-03-10', '2026-03-10')).toBe(4);
  });

  it.each([
    [2, 'toddlers'],
    [3, 'toddlers'],
    [4, 'kids'],
    [7, 'kids'],
    [8, 'juniors'],
    [12, 'juniors'],
  ] as const)('age %i is in the %s band', (age, band) => {
    expect(bandForAge(age, bands, rules.creche.minAcceptedAge)).toMatchObject({ ok: true, band });
  });

  it('rejects under 2 and suggests the teen zone over 12', () => {
    expect(bandForAge(1, bands, 2)).toMatchObject({ ok: false, reason: 'too_young' });
    expect(bandForAge(13, bands, 2)).toMatchObject({
      ok: false,
      reason: 'too_old',
      message: 'Teen zone is not supervised.',
    });
    expect(bandForChild('2022-03-10', '2026-10-14', bands, 2)).toMatchObject({ band: 'kids' });
  });
});

describe('ratio capacity', () => {
  it.each([
    ['toddlers', 1, 4],
    ['toddlers', 2, 8],
    ['kids', 1, 8],
    ['kids', 2, 16],
    ['juniors', 1, 10],
    ['juniors', 3, 30],
  ] as const)('%s with %i staff allows %i', (band, staff, expected) => {
    expect(bandCapacity(staff, band, bands)).toBe(expected);
  });

  it('a band with no staff allows nobody, and the overage is reported', () => {
    expect(bandCapacity(0, 'kids', bands)).toBe(0);
    expect(bandLoad('kids', ['a'], 12, bands)).toMatchObject({ capacity: 8, overBy: 4 });
    expect(bandLoad('kids', ['a', 'b'], 12, bands)).toMatchObject({ capacity: 16, overBy: 0 });
  });

  it('a sick shift overlapping the session takes that carer off the band', () => {
    const assignments: BandAssignment[] = [
      { date: '2026-10-14', band: 'kids', staffIds: ['grace', 'aisha'] },
    ];
    const sick: Shift = {
      id: 'sh',
      createdAt: T,
      updatedAt: T,
      staffId: 'grace',
      date: '2026-10-14',
      start: '2026-10-14T04:45:00.000Z',
      end: '2026-10-14T14:15:00.000Z',
      amenity: 'creche',
      band: 'kids',
      state: 'sick',
    };
    expect(staffOnBand(assignments, [], '2026-10-14', 'kids', session.start, session.end)).toEqual([
      'grace',
      'aisha',
    ]);
    expect(
      staffOnBand(assignments, [sick], '2026-10-14', 'kids', session.start, session.end),
    ).toEqual(['aisha']);
    expect(
      staffOnBand(assignments, [sick], '2026-10-15', 'kids', session.start, session.end),
    ).toEqual([]);
  });

  it('counts only active bookings in overlapping sessions', () => {
    const list = [
      booking('a', 'confirmed', T),
      booking('b', 'checked_in', T),
      booking('c', 'waitlisted', T),
      booking('d', 'cancelled', T),
    ];
    expect(countActiveInWindow(list, { s1: session }, 'kids', session.start, session.end)).toBe(2);
    expect(countActiveInWindow(list, { s1: session }, 'toddlers', session.start, session.end)).toBe(
      0,
    );
    expect(
      countActiveInWindow(list, { s1: session }, 'kids', session.end, '2026-10-14T09:00:00.000Z'),
    ).toBe(0);
  });
});

describe('booking validation', () => {
  const base = {
    now: '2026-10-14T03:30:00.000Z',
    child,
    actorUnitId: 'E-1804',
    session,
    band: bandForChild(child.dob, '2026-10-14', bands, 2),
    childOverlapping: 0,
    bandCount: 11,
    bandCapacity: 16,
    roomCount: 16,
    roomCap: 30,
    windowDays: 7,
    leadTimeHours: 1,
    dropIn: { minHours: 1, maxHours: 3 },
  };

  it('confirms with room to spare', () => {
    expect(validateCrecheBooking(base)).toEqual({ ok: true, band: 'kids', state: 'confirmed' });
  });

  it('rejects another unit, the lead time, the window, and a double booking', () => {
    expect(validateCrecheBooking({ ...base, actorUnitId: 'W-2203' })).toMatchObject({
      code: 'NOT_ELIGIBLE',
    });
    expect(validateCrecheBooking({ ...base, now: '2026-10-14T04:30:00.000Z' })).toMatchObject({
      code: 'LEAD_TIME',
    });
    expect(validateCrecheBooking({ ...base, now: '2026-10-05T03:30:00.000Z' })).toMatchObject({
      code: 'WINDOW_NOT_OPEN',
    });
    expect(validateCrecheBooking({ ...base, childOverlapping: 1 })).toMatchObject({
      code: 'ALREADY_BOOKED',
    });
  });

  it('waitlists on a full band or a full room instead of refusing', () => {
    expect(validateCrecheBooking({ ...base, bandCount: 16 })).toMatchObject({
      ok: true,
      state: 'waitlisted',
    });
    expect(validateCrecheBooking({ ...base, roomCount: 30 })).toMatchObject({
      ok: true,
      state: 'waitlisted',
    });
  });

  it('holds drop-ins to 1–3 hours', () => {
    const dropin = { ...session, kind: 'dropin' as const, end: '2026-10-14T09:00:00.000Z' };
    expect(validateCrecheBooking({ ...base, session: dropin })).toMatchObject({
      code: 'INVALID_DURATION',
    });
  });
});

describe('check-in validation', () => {
  const base = {
    now: '2026-10-14T05:04:00.000Z',
    child,
    guardian: { ok: true } as const,
    booking: booking('c1', 'confirmed', T),
    session,
    opensMinutesBefore: 15,
    band: 'kids' as const,
    inRoom: 11,
    capacity: 16,
    roomInRoom: 16,
    roomCap: 30,
    bandBooked: 12,
    allergyAck: false,
  };

  it('passes for a booked child with an authorised guardian', () => {
    expect(validateCheckIn(base)).toEqual({ ok: true });
  });

  it('blocks in PRD order: unregistered, guardian, no booking, ratio, room', () => {
    expect(validateCheckIn({ ...base, child: undefined })).toMatchObject({
      code: 'NOT_REGISTERED',
    });
    expect(
      validateCheckIn({ ...base, guardian: { ok: false, reason: 'not_listed', message: 'x' } }),
    ).toMatchObject({ code: 'GUARDIAN_NOT_AUTHORISED' });
    expect(validateCheckIn({ ...base, booking: undefined, bandBooked: 16 })).toMatchObject({
      code: 'NO_SESSION',
    });
    expect(validateCheckIn({ ...base, inRoom: 8, capacity: 8 })).toMatchObject({
      code: 'RATIO_EXCEEDED',
      message: 'Kids band at 8/8 — add staff or wait.',
    });
    expect(validateCheckIn({ ...base, roomInRoom: 30 })).toMatchObject({ code: 'ROOM_FULL' });
  });

  it('needs the allergy plan ticked for a severe allergy', () => {
    const allergic = { ...child, allergies: { text: 'Nuts', severe: true } };
    expect(validateCheckIn({ ...base, child: allergic })).toMatchObject({
      code: 'ALLERGY_ACK_REQUIRED',
    });
    expect(validateCheckIn({ ...base, child: allergic, allergyAck: true })).toEqual({ ok: true });
  });

  it('only opens a little before the session', () => {
    expect(validateCheckIn({ ...base, now: '2026-10-14T04:30:00.000Z' })).toMatchObject({
      code: 'NO_SESSION',
    });
    expect(validateCheckIn({ ...base, now: '2026-10-14T04:46:00.000Z' })).toEqual({ ok: true });
  });
});

describe('guardians', () => {
  it('approves a listed, approved, in-date guardian', () => {
    expect(guardianAuthorisation(guardian(), child, T)).toEqual({ ok: true });
  });

  it('blocks unlisted, pending, rejected and expired guardians with a reason', () => {
    expect(guardianAuthorisation(guardian({ id: 'g9' }), child, T)).toMatchObject({
      reason: 'not_listed',
    });
    expect(guardianAuthorisation(guardian({ approval: 'pending' }), child, T)).toMatchObject({
      reason: 'pending',
    });
    expect(guardianAuthorisation(guardian({ approval: 'rejected' }), child, T)).toMatchObject({
      reason: 'rejected',
    });
    expect(
      guardianAuthorisation(
        guardian({ validUntil: '2026-10-13T00:00:00.000Z', name: 'Rosa' }),
        child,
        T,
      ),
    ).toMatchObject({ reason: 'expired', message: "Rosa's authorisation expired." });
  });
});

describe('fees', () => {
  it('charges tenants on actual time, rounded up to 30 minutes', () => {
    expect(sessionFeeFils('2026-10-14T05:00:00Z', '2026-10-14T06:00:00Z', 4000, 30)).toBe(4000);
    expect(sessionFeeFils('2026-10-14T05:00:00Z', '2026-10-14T06:01:00Z', 4000, 30)).toBe(6000);
    expect(sessionFeeFils('2026-10-14T05:00:00Z', '2026-10-14T07:12:00Z', 4000, 30)).toBe(10000);
  });

  it('starts the late fee after the grace period, per started 15 minutes', () => {
    const end = '2026-10-14T08:00:00Z';
    expect(lateFeeFils(end, '2026-10-14T08:10:00Z', 10, 5000)).toBe(0);
    expect(lateFeeFils(end, '2026-10-14T08:11:00Z', 10, 5000)).toBe(5000);
    expect(lateFeeFils(end, '2026-10-14T08:40:00Z', 10, 5000)).toBe(10000);
    expect(lateMinutes(end, '2026-10-14T08:25:00Z', 10)).toBe(15);
  });
});

describe('rebalance after a roster change', () => {
  it('moves the latest-booked confirmed children to the waitlist; children in the room stay', () => {
    const list = [
      booking('in1', 'checked_in', '2026-10-10T00:00:00Z'),
      booking('in2', 'checked_in', '2026-10-10T00:01:00Z'),
      booking('early', 'confirmed', '2026-10-11T00:00:00Z'),
      booking('late', 'confirmed', '2026-10-12T00:00:00Z'),
    ];
    expect(planRebalance(list, 3)).toEqual({ demote: ['late'], promote: [] });
    expect(planRebalance(list, 1)).toEqual({ demote: ['late', 'early'], promote: [] });
  });

  it('confirms the waitlist in booking order when capacity recovers', () => {
    const list = [
      booking('in', 'checked_in', '2026-10-10T00:00:00Z'),
      booking('w2', 'waitlisted', '2026-10-12T00:00:00Z'),
      booking('w1', 'waitlisted', '2026-10-11T00:00:00Z'),
    ];
    expect(planRebalance(list, 2)).toEqual({ demote: [], promote: ['w1'] });
    expect(planRebalance(list, 8)).toEqual({ demote: [], promote: ['w1', 'w2'] });
  });
});
