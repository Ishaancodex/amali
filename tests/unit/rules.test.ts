import { describe, it, expect } from 'vitest';
import { rules } from '@/config/rules';

describe('config/rules — parses and matches PRD §8 mock values', () => {
  it('padel: 1 court, 7-day window, 3/week quota, 6h free cancel', () => {
    expect(rules.padel.courts).toBe(1);
    expect(rules.padel.bookingWindowDays).toBe(7);
    expect(rules.padel.quota.maxBookings).toBe(3);
    expect(rules.padel.quota.maxPeakPerWeek).toBe(2);
    expect(rules.padel.freeCancellationHoursBefore).toBe(6);
    expect(rules.padel.penalty.strikesToSuspend).toBe(3);
    expect(rules.padel.penalty.suspensionDays).toBe(7);
  });

  it('screening: 22 seats (20 + 2 accessible), music: 12 headcount', () => {
    expect(rules.screening.capacity).toBe(22);
    expect(rules.music.capacity).toBe(12);
  });

  it('creche: ratio bands and AED 40/hr tenant fee', () => {
    expect(rules.creche.bands.kids.ratioStaffToChildren).toBe(8);
    expect(rules.creche.roomCapacityAbsolute).toBe(30);
    expect(rules.creche.tenantFeePerHourFils).toBe(4000);
  });

  it('dining: Teppanyaki AED 350pp, PDR AED 1,500 minimum spend', () => {
    expect(rules.dining.teppanyaki.pricePerPersonFils).toBe(35000);
    expect(rules.dining.pdr.minimumSpendFils).toBe(150000);
  });

  it('pool water quality: pH 7.2-7.8', () => {
    expect(rules.pool.waterQuality.ph).toEqual({ min: 7.2, max: 7.8 });
  });

  it('ops SLA bands match the PRD table', () => {
    expect(rules.ops.sla.P1).toEqual({ respondMinutes: 30, resolveMinutes: 240 });
    expect(rules.ops.sla.P2).toEqual({ respondMinutes: 120, resolveMinutes: 1440 });
    expect(rules.ops.sla.P3).toEqual({ respondMinutes: 480, resolveMinutes: 4320 });
  });

  it('comms: 1024 char WhatsApp limit, quiet hours 22:00-07:00', () => {
    expect(rules.comms.waCharacterLimit).toBe(1024);
    expect(rules.comms.quietHours).toEqual({ start: '22:00', end: '07:00' });
  });
});
