import { describe, it, expect } from 'vitest';
import { computeQuotaUsage, quotaCountingBookings, quotaWouldExceed } from '@/domain/booking/quota';
import { activeStrikes, isCurrentlySuspended, nextStrikeOutcome } from '@/domain/booking/strikes';
import { planOffer } from '@/domain/booking/waitlistOffer';
import { computeBlackoutImpact } from '@/domain/booking/blackoutImpact';
import { occupiedGridCells, resourceKey } from '@/domain/booking/slots';
import type { Booking, Strike, Suspension, WaitlistEntry } from '@/types/booking';

const NOW = '2026-10-14T13:30:00.000Z';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_1',
    createdAt: NOW,
    updatedAt: NOW,
    amenity: 'padel',
    unitId: 'W-2203',
    bookerId: 'res_booker',
    start: '2026-10-13T15:00:00.000Z',
    end: '2026-10-13T16:00:00.000Z',
    players: [],
    charges: [],
    state: 'confirmed',
    history: [],
    source: 'resident',
    countsTowardQuota: true,
    ...overrides,
  };
}

describe('domain/booking/quota', () => {
  it('quotaCountingBookings excludes bookings outside the rolling window and non-counting states', () => {
    const inWindow = booking({ id: 'a', start: '2026-10-13T15:00:00.000Z' });
    const tooOld = booking({ id: 'b', start: '2026-10-01T15:00:00.000Z' });
    const cancelledOnTime = booking({ id: 'c', state: 'cancelled' });
    const result = quotaCountingBookings([inWindow, tooOld, cancelledOnTime], NOW);
    expect(result.map((b) => b.id)).toEqual(['a']);
  });

  it('computeQuotaUsage counts total, peak and per-day buckets', () => {
    const usage = computeQuotaUsage([
      booking({ id: 'a', start: '2026-10-12T15:00:00.000Z' }), // 19:00 Dubai — peak
      booking({ id: 'b', start: '2026-10-13T06:00:00.000Z' }), // 10:00 Dubai — not peak
    ]);
    expect(usage.total).toBe(2);
    expect(usage.peak).toBe(1);
  });

  it('quotaWouldExceed trips on total, per-day, and peak sub-limits', () => {
    expect(
      quotaWouldExceed({ total: 3, peak: 0, byDayCount: {} }, '2026-10-15T10:00:00.000Z'),
    ).toBe(true);
    expect(
      quotaWouldExceed(
        { total: 1, peak: 0, byDayCount: { '2026-10-15': 1 } },
        '2026-10-15T10:00:00.000Z',
      ),
    ).toBe(true);
    expect(
      quotaWouldExceed(
        { total: 1, peak: 2, byDayCount: {} },
        '2026-10-15T15:00:00.000Z' /* 19:00 */,
      ),
    ).toBe(true);
    expect(
      quotaWouldExceed({ total: 0, peak: 0, byDayCount: {} }, '2026-10-15T10:00:00.000Z'),
    ).toBe(false);
  });
});

describe('domain/booking/strikes', () => {
  function strike(at: string, id = 's1'): Strike {
    return {
      id,
      createdAt: at,
      updatedAt: at,
      residentId: 'res_1',
      unitId: 'W-2203',
      amenity: 'padel',
      kind: 'no_show',
      at,
      bookingId: 'bk_1',
    };
  }

  it('activeStrikes filters to the rolling penalty window', () => {
    const inWindow = strike('2026-10-01T00:00:00.000Z', 'a');
    const tooOld = strike('2026-08-01T00:00:00.000Z', 'b');
    expect(activeStrikes([inWindow, tooOld], NOW).map((s) => s.id)).toEqual(['a']);
  });

  it('nextStrikeOutcome warns at strike 2 and suspends at strike 3', () => {
    expect(nextStrikeOutcome(0)).toMatchObject({ strikeCount: 1, warns: false, suspends: false });
    expect(nextStrikeOutcome(1)).toMatchObject({ strikeCount: 2, warns: true, suspends: false });
    expect(nextStrikeOutcome(2)).toMatchObject({ strikeCount: 3, warns: false, suspends: true });
  });

  it('isCurrentlySuspended finds an active, unlifted suspension covering now', () => {
    const active: Suspension = {
      id: 'susp_1',
      createdAt: NOW,
      updatedAt: NOW,
      residentId: 'res_1',
      amenity: 'padel',
      from: '2026-10-14T00:00:00.000Z',
      to: '2026-10-21T00:00:00.000Z',
    };
    const lifted: Suspension = { ...active, id: 'susp_2', liftedBy: 'staff_hana' };
    const expired: Suspension = { ...active, id: 'susp_3', to: '2026-10-10T00:00:00.000Z' };
    expect(isCurrentlySuspended([active], NOW)?.id).toBe('susp_1');
    expect(isCurrentlySuspended([lifted], NOW)).toBeUndefined();
    expect(isCurrentlySuspended([expired], NOW)).toBeUndefined();
  });
});

describe('domain/booking/waitlistOffer', () => {
  it('offers sequentially, capped at sequentialOfferMinutes, when well ahead of the slot', () => {
    const plan = planOffer(NOW, '2026-10-16T13:30:00.000Z'); // 2 days ahead
    expect(plan.mode).toBe('sequential');
    expect(plan.expiresAt).toBe('2026-10-14T13:45:00.000Z'); // now + 15 min
  });

  it('at exactly the open-release threshold (45 min out), still offers sequentially', () => {
    // openReleaseThresholdMinutes (45) equals sequentialOfferMinutes + minMinutesBeforeStartForOffer
    // (15 + 30) by design, so the standard 15-minute offer always already ends >= 30 min before
    // the slot whenever it's offered sequentially at all — the shortening only bites with other
    // rule values, but the mode switch at the boundary itself is still worth pinning down.
    const slotStart = '2026-10-14T14:15:00.000Z'; // 45 min from NOW
    const plan = planOffer(NOW, slotStart);
    expect(plan.mode).toBe('sequential');
    expect(plan.expiresAt).toBe('2026-10-14T13:45:00.000Z'); // now + 15 min, 30 min before slotStart
  });

  it('switches to open release under the 45-minute threshold', () => {
    const slotStart = '2026-10-14T14:00:00.000Z'; // 30 min from NOW
    const plan = planOffer(NOW, slotStart);
    expect(plan).toEqual({ mode: 'open_release', expiresAt: slotStart });
  });
});

describe('domain/booking/blackoutImpact', () => {
  it('tallies affected bookings, residents, guest fees and waitlist entries', () => {
    const affected = booking({
      id: 'bk_affected',
      bookerId: 'res_ahmed',
      start: '2026-10-15T13:00:00.000Z',
      end: '2026-10-15T14:00:00.000Z',
      players: [{ guestName: 'Guest', guestPhone: '1' }],
    });
    const outside = booking({
      id: 'bk_outside',
      start: '2026-10-20T13:00:00.000Z',
      end: '2026-10-20T14:00:00.000Z',
    });
    const waitingInRange: WaitlistEntry = {
      id: 'wl_1',
      createdAt: NOW,
      updatedAt: NOW,
      resourceKey: resourceKey('padel', '2026-10-15T13:00:00.000Z'),
      residentId: 'res_layla',
      partySize: 1,
      position: 1,
      state: 'waiting',
    };

    const impact = computeBlackoutImpact(
      '2026-10-15T06:00:00.000Z',
      '2026-10-16T12:00:00.000Z',
      [affected, outside],
      [waitingInRange],
    );

    expect(impact.affectedBookings.map((b) => b.id)).toEqual(['bk_affected']);
    expect(impact.affectedResidentCount).toBe(1);
    expect(impact.guestFeesToRefundFils).toBe(5000);
    expect(impact.affectedWaitlistEntries).toHaveLength(1);
  });
});

describe('domain/booking/slots — occupiedGridCells', () => {
  it('a 90-minute booking spans 3 grid cells', () => {
    expect(occupiedGridCells('2026-10-15T13:00:00.000Z', 90)).toEqual([
      '2026-10-15T13:00:00.000Z',
      '2026-10-15T13:30:00.000Z',
      '2026-10-15T14:00:00.000Z',
    ]);
  });
});
