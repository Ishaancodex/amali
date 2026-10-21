import { describe, it, expect } from 'vitest';
import {
  averageHeatmap,
  bookableMinutes,
  covers,
  lateCancellationRate,
  noShowRate,
  occupancy,
  peakWindows,
  revenue,
  slaCompliance,
  utilisation,
  utilisationHeatmap,
  waitlistConversion,
} from '@/domain/reports/kpis';
import { modelledFraction } from '@/domain/reports/occupancy';
import { rules } from '@/config/rules';

const T = (h: string) => `2026-10-14T${h}:00.000Z`;

describe('utilisation = booked minutes ÷ (open hours − blackouts)', () => {
  const open = [{ start: T('04:00'), end: T('14:00') }]; // 10h = 600 min

  it('counts only booked minutes inside opening hours', () => {
    const booked = [
      { start: T('05:00'), end: T('06:00') }, // 60
      { start: T('13:30'), end: T('14:30') }, // 30 inside
    ];
    expect(utilisation(booked, open, [])).toBe(90 / 600);
  });

  it('removes blackout minutes from what was bookable', () => {
    expect(bookableMinutes(open, [{ start: T('08:00'), end: T('10:00') }])).toBe(480);
    expect(
      utilisation([{ start: T('05:00'), end: T('07:00') }], open, [
        { start: T('08:00'), end: T('10:00') },
      ]),
    ).toBe(120 / 480);
  });

  it('is undefined with nothing bookable', () => {
    expect(utilisation([], [], [])).toBeUndefined();
  });
});

describe('occupancy = average headcount ÷ capacity, per hour', () => {
  it('averages the hourly samples', () => {
    expect(occupancy([10, 20, 30], 40)).toBe(0.5);
    expect(occupancy([], 40)).toBeUndefined();
  });

  it('the model peaks where the PRD says, and drops to zero when closed', () => {
    const h = rules.seedHistory;
    expect(modelledFraction('pool', 6, 12, 1, true, h)).toBeGreaterThan(
      modelledFraction('pool', 2, 12, 1, true, h),
    );
    expect(modelledFraction('gym', 2, 7, 1, true, h)).toBeGreaterThan(
      modelledFraction('gym', 2, 13, 1, true, h),
    );
    expect(modelledFraction('pool', 6, 12, 1, false, h)).toBe(0);
  });
});

describe('peak time', () => {
  it('builds weekday × hour cells and returns the top windows', () => {
    const open = [{ start: T('04:00'), end: T('07:00') }]; // 08:00–11:00 Dubai, 3 cells
    const booked = [
      { start: T('05:00'), end: T('06:00') },
      { start: T('06:00'), end: T('06:30') },
    ];
    const cells = utilisationHeatmap(
      open.length ? booked : [],
      open,
      () => 3,
      (iso) => Number(iso.slice(11, 13)) + 4,
    );
    expect(cells.map((c) => [c.hour, c.value])).toEqual([
      [8, 0],
      [9, 1],
      [10, 0.5],
    ]);
    expect(peakWindows(cells, 1)[0]).toMatchObject({ hour: 9, value: 1 });
    expect(
      averageHeatmap([
        { weekday: 1, hour: 7, value: 0.2 },
        { weekday: 1, hour: 7, value: 0.4 },
      ])[0]?.value,
    ).toBeCloseTo(0.3);
  });
});

describe('no-show and cancellation rates', () => {
  const now = T('12:00');
  const items = [
    { start: T('08:00'), outcome: 'attended' as const },
    { start: T('09:00'), outcome: 'no_show' as const },
    { start: T('10:00'), outcome: 'attended' as const },
    { start: T('10:30'), outcome: 'cancelled' as const },
    { start: T('11:00'), outcome: 'late_cancelled' as const },
    { start: T('11:30'), outcome: 'late_cancelled' as const },
    { start: T('15:00'), outcome: 'upcoming' as const },
  ];

  it('no-shows ÷ bookings started and not cancelled', () => {
    expect(noShowRate(items, now)).toBeCloseTo(1 / 3);
  });

  it('late cancels ÷ all cancels', () => {
    expect(lateCancellationRate(items)).toBeCloseTo(2 / 3);
  });

  it('waitlist conversion = accepted ÷ offers sent', () => {
    expect(
      waitlistConversion([
        { accepted: true },
        { accepted: false },
        { accepted: true },
        { accepted: true },
      ]),
    ).toBe(0.75);
    expect(waitlistConversion([])).toBeUndefined();
  });
});

describe('revenue', () => {
  it('sums every chargeable source and subtracts refunds; top-ups and holds are not revenue', () => {
    const r = revenue([
      { kind: 'charge', fils: -5000, label: 'Padel guest fee', ref: { type: 'booking', id: 'b' } },
      { kind: 'charge', fils: -2500, label: 'Event tickets', ref: { type: 'rsvp', id: 'r' } },
      {
        kind: 'charge',
        fils: -40000,
        label: 'Restaurant bill',
        ref: { type: 'reservation', id: 'x' },
      },
      {
        kind: 'charge',
        fils: -30000,
        label: 'Minimum spend top-up',
        ref: { type: 'reservation', id: 'p' },
      },
      {
        kind: 'charge',
        fils: -112000,
        label: 'Teppanyaki bill',
        ref: { type: 'reservation', id: 't' },
      },
      {
        kind: 'charge',
        fils: -8000,
        label: 'Kids’ Club session',
        ref: { type: 'crecheBooking', id: 'c' },
      },
      {
        kind: 'charge',
        fils: -10000,
        label: 'Kids’ Club late pickup',
        ref: { type: 'crecheBooking', id: 'c' },
      },
      {
        kind: 'refund',
        fils: 5000,
        label: 'Padel blackout refund',
        ref: { type: 'booking', id: 'b' },
      },
      { kind: 'topup', fils: 50000, label: 'Wallet top-up' },
      {
        kind: 'hold',
        fils: -40000,
        label: 'Teppanyaki deposit',
        ref: { type: 'reservation', id: 't' },
      },
    ]);
    expect(r.bySource).toEqual({
      'Guest fees': 5000,
      'Event tickets': 2500,
      'F&B settled': 40000,
      'PDR minimum-spend top-ups': 30000,
      Teppanyaki: 112000,
      'Creche fees': 8000,
      'Late-pickup fees': 10000,
    });
    expect(r.refunds).toBe(5000);
    expect(r.total).toBe(207500 - 5000);
  });
});

describe('covers and SLA compliance', () => {
  it('covers = seated guests in the period', () => {
    const period = { start: T('14:00'), end: T('19:00') };
    expect(
      covers(
        [
          { start: T('15:00'), state: 'completed', partySize: 4 },
          { start: T('16:00'), state: 'seated', partySize: 2 },
          { start: T('16:00'), state: 'no_show', partySize: 3 },
          { start: T('08:00'), state: 'completed', partySize: 5 },
        ],
        period,
      ),
    ).toBe(6);
  });

  it('SLA compliance = resolved within SLA ÷ resolved', () => {
    expect(
      slaCompliance([
        { withinSla: true },
        { withinSla: true },
        { withinSla: false },
        { withinSla: true },
      ]),
    ).toBe(0.75);
    expect(slaCompliance([])).toBeUndefined();
  });
});
