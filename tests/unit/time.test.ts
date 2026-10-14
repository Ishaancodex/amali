import { describe, it, expect } from 'vitest';
import {
  fmtTime,
  fmtDate,
  dubaiWeekday,
  dubaiDateKey,
  addMinutesIso,
  addHoursIso,
  addDaysIso,
  addMillisecondsIso,
  minutesBetween,
  isBeforeIso,
  isAfterIso,
  dubaiDateTimeToIso,
  rangesOverlap,
  startOfDubaiDay,
} from '@/lib/time';

describe('lib/time', () => {
  it('formats a UTC ISO string in Asia/Dubai (UTC+4)', () => {
    // 13:30 UTC -> 17:30 Dubai
    expect(fmtTime('2026-10-14T13:30:00.000Z')).toBe('17:30');
  });

  it('formats a Dubai-local date', () => {
    expect(fmtDate('2026-10-14T13:30:00.000Z')).toBe('Wed 14 Oct');
  });

  it('derives the Dubai weekday (0=Sun..6=Sat)', () => {
    // 2026-10-14 is a Wednesday in Dubai local time.
    expect(dubaiWeekday('2026-10-14T13:30:00.000Z')).toBe(3);
  });

  it('a late-UTC timestamp can fall on the next Dubai calendar day', () => {
    // 2026-10-14T21:00:00Z = 2026-10-15 01:00 Dubai.
    expect(dubaiDateKey('2026-10-14T21:00:00.000Z')).toBe('2026-10-15');
  });

  it('round-trips dubaiDateTimeToIso -> fmtTime', () => {
    const iso = dubaiDateTimeToIso('2026-10-15', '09:30');
    expect(fmtTime(iso)).toBe('09:30');
    expect(dubaiDateKey(iso)).toBe('2026-10-15');
  });

  it('addMinutesIso / addHoursIso / addDaysIso / addMillisecondsIso add the right amount', () => {
    const base = '2026-10-14T13:30:00.000Z';
    expect(addMinutesIso(base, 15)).toBe('2026-10-14T13:45:00.000Z');
    expect(addHoursIso(base, 2)).toBe('2026-10-14T15:30:00.000Z');
    expect(addDaysIso(base, 1)).toBe('2026-10-15T13:30:00.000Z');
    expect(addMillisecondsIso(base, 500)).toBe('2026-10-14T13:30:00.500Z');
  });

  it('minutesBetween is positive going forward, negative going backward', () => {
    const a = '2026-10-14T13:30:00.000Z';
    const b = '2026-10-14T14:00:00.000Z';
    expect(minutesBetween(a, b)).toBe(30);
    expect(minutesBetween(b, a)).toBe(-30);
  });

  it('isBeforeIso / isAfterIso', () => {
    const a = '2026-10-14T13:00:00.000Z';
    const b = '2026-10-14T14:00:00.000Z';
    expect(isBeforeIso(a, b)).toBe(true);
    expect(isAfterIso(b, a)).toBe(true);
    expect(isBeforeIso(b, a)).toBe(false);
  });

  it('rangesOverlap detects overlap and non-overlap', () => {
    const a1 = '2026-10-14T13:00:00.000Z';
    const a2 = '2026-10-14T14:00:00.000Z';
    const b1 = '2026-10-14T13:30:00.000Z';
    const b2 = '2026-10-14T15:00:00.000Z';
    expect(rangesOverlap(a1, a2, b1, b2)).toBe(true);
    // adjacent, non-overlapping ranges
    expect(rangesOverlap(a1, a2, a2, b2)).toBe(false);
  });

  it('startOfDubaiDay anchors to Dubai midnight, not UTC midnight', () => {
    const start = startOfDubaiDay('2026-10-14T21:00:00.000Z'); // 01:00 Dubai next day
    // Dubai midnight of 2026-10-15 is 2026-10-14T20:00:00Z.
    expect(start).toBe('2026-10-14T20:00:00.000Z');
  });
});
