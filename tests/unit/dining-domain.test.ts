import { describe, it, expect } from 'vitest';
import { rules } from '@/config/rules';
import { dubaiDateTimeToIso, addDaysIso } from '@/lib/time';
import {
  periodsFor,
  ramadanLunchConflicts,
  startTimes,
  tableMinutes,
} from '@/domain/dining/periods';
import { allocateTables, counterSeatsLeft, freeFraction } from '@/domain/dining/tables';
import { validateReservation } from '@/domain/dining/validate';
import { depositFor, isLateCancellation, repeatNoShowStatus } from '@/domain/dining/policy';
import { coversFor, coversForecast, tableState } from '@/domain/dining/service';
import { buildTables } from '@/seed/dining';
import type { Reservation } from '@/types/dining';

const dining = rules.dining;
const DATE = '2026-10-16';
const at = (hhmm: string, date = DATE) => dubaiDateTimeToIso(date, hhmm);
const NOW = at('17:00');
const tables = Object.values(buildTables(NOW));

let seq = 0;
function res(over: Partial<Reservation>): Reservation {
  seq += 1;
  return {
    id: `r${seq}`,
    createdAt: NOW,
    updatedAt: NOW,
    venue: 'restaurant',
    residentId: 'res_a',
    unitId: 'U1',
    start: at('19:00'),
    end: at('20:30'),
    period: 'dinner',
    partySize: 2,
    dietary: [],
    tableIds: [],
    mode: 'instant',
    state: 'confirmed',
    ...over,
  };
}

describe('periods', () => {
  it('Restaurant has breakfast, lunch, dinner; PDR lunch and dinner; Teppanyaki one dinner window', () => {
    expect(periodsFor('restaurant', DATE, dining).map((p) => p.period)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
    ]);
    expect(periodsFor('pdr', DATE, dining).map((p) => p.period)).toEqual(['lunch', 'dinner']);
    expect(startTimes('teppanyaki', periodsFor('teppanyaki', DATE, dining)[0]!, 4, dining)).toEqual(
      [at('19:00'), at('21:00')],
    );
  });

  it('Iftar at sunset replaces Lunch during Ramadan', () => {
    const periods = periodsFor('restaurant', '2027-02-20', dining);
    expect(periods.map((p) => p.period)).toEqual(['breakfast', 'iftar', 'dinner']);
    expect(periods[1]!.start).toBe(dubaiDateTimeToIso('2027-02-20', dining.ramadan.iftarAt));
  });

  it('flags existing lunch reservations that fall in Ramadan', () => {
    const list = [
      res({ period: 'lunch', start: at('13:00', '2027-02-20') }),
      res({ period: 'lunch', start: at('13:00', '2027-01-20') }),
      res({ period: 'dinner', start: at('19:00', '2027-02-20') }),
      res({ period: 'lunch', start: at('13:00', '2027-02-21'), state: 'cancelled' }),
    ];
    expect(ramadanLunchConflicts(list, dining)).toHaveLength(1);
  });

  it('grid starts every 15 minutes up to the last that still fits the table time', () => {
    const dinner = periodsFor('restaurant', DATE, dining)[2]!;
    const times = startTimes('restaurant', dinner, 2, dining);
    expect(times[0]).toBe(at('18:00'));
    expect(times.at(-1)).toBe(at('21:30')); // 90 min before 23:00
    expect(startTimes('restaurant', dinner, 6, dining).at(-1)).toBe(at('21:00')); // 120 min for 5+
    expect(tableMinutes('restaurant', 5, dining)).toBe(120);
  });
});

describe('table allocation', () => {
  it('picks the smallest free table that fits, in the requested zone', () => {
    expect(
      allocateTables({
        tables,
        reservations: [],
        venue: 'restaurant',
        start: at('19:00'),
        end: at('20:30'),
        partySize: 3,
        zone: 'canal',
      }),
    ).toEqual({ tableIds: ['T14'], zoneHonoured: true });
  });

  it('combines adjacent tables for a big party before leaving the zone', () => {
    const taken = [res({ tableIds: ['T12'] })];
    expect(
      allocateTables({
        tables,
        reservations: taken,
        venue: 'restaurant',
        start: at('19:00'),
        end: at('20:30'),
        partySize: 8,
        zone: 'terrace',
      }),
    ).toEqual({ tableIds: ['T10', 'T11'], zoneHonoured: true });
  });

  it('falls back outside the zone, marking it not honoured', () => {
    const taken = ['T13', 'T14', 'T15', 'T16', 'T17'].map((t) => res({ tableIds: [t] }));
    expect(
      allocateTables({
        tables,
        reservations: taken,
        venue: 'restaurant',
        start: at('19:00'),
        end: at('20:30'),
        partySize: 2,
        zone: 'canal',
      }),
    ).toMatchObject({ zoneHonoured: false });
  });

  it('the Teppanyaki counter is shared seats', () => {
    const booked = [
      res({
        venue: 'teppanyaki',
        partySize: 6,
        start: at('21:00'),
        end: at('23:00'),
        tableIds: ['COUNTER'],
      }),
    ];
    expect(counterSeatsLeft(10, booked, at('21:00'), at('23:00'))).toBe(4);
    expect(
      allocateTables({
        tables,
        reservations: booked,
        venue: 'teppanyaki',
        start: at('21:00'),
        end: at('23:00'),
        partySize: 5,
      }),
    ).toBeUndefined();
    expect(freeFraction(tables, booked, 'teppanyaki', at('21:00'), at('23:00'))).toBe(0.4);
  });
});

describe('reservation validation', () => {
  const base = {
    now: NOW,
    venue: 'restaurant' as const,
    start: at('19:00'),
    partySize: 2,
    tables,
    reservations: [],
    depositFils: 0,
    availableFils: 0,
    dining,
  };

  it('books a free table instantly', () => {
    expect(validateReservation(base)).toMatchObject({
      ok: true,
      mode: 'instant',
      period: 'dinner',
    });
  });

  it('checks party size, lead time, the grid and the window', () => {
    expect(validateReservation({ ...base, partySize: 13 })).toMatchObject({ code: 'GUEST_LIMIT' });
    expect(
      validateReservation({
        ...base,
        venue: 'pdr',
        partySize: 8,
        start: at('19:00', '2026-10-17'),
      }),
    ).toMatchObject({ code: 'LEAD_TIME' });
    expect(validateReservation({ ...base, start: at('19:05') })).toMatchObject({
      code: 'OUTSIDE_HOURS',
    });
    expect(validateReservation({ ...base, start: addDaysIso(at('19:00'), 31) })).toMatchObject({
      code: 'WINDOW_NOT_OPEN',
    });
  });

  it('a party of 9+ is a request for the manager', () => {
    expect(validateReservation({ ...base, partySize: 10 })).toMatchObject({
      ok: true,
      mode: 'request',
    });
  });

  it('a full Teppanyaki seating offers split seating or the waitlist', () => {
    const booked = [
      res({
        venue: 'teppanyaki',
        partySize: 8,
        start: at('21:00'),
        end: at('23:00'),
        tableIds: ['COUNTER'],
      }),
    ];
    expect(
      validateReservation({
        ...base,
        venue: 'teppanyaki',
        start: at('21:00'),
        partySize: 4,
        reservations: booked,
      }),
    ).toMatchObject({ code: 'SLOT_FULL', params: { seatsLeft: 2 } });
  });

  it('a deposit bigger than what is available asks for a top-up, with the shortfall', () => {
    expect(
      validateReservation({
        ...base,
        venue: 'teppanyaki',
        start: at('21:00'),
        partySize: 4,
        depositFils: 40000,
        availableFils: 12000,
      }),
    ).toMatchObject({ code: 'INSUFFICIENT_BALANCE', params: { shortfallFils: 28000 } });
  });
});

describe('deposits and the no-show policy', () => {
  it('PDR is flat, Teppanyaki per person, the Restaurant free unless repeat no-shows', () => {
    expect(depositFor('pdr', 8, false, dining)).toBe(50000);
    expect(depositFor('teppanyaki', 4, false, dining)).toBe(40000);
    expect(depositFor('restaurant', 4, false, dining)).toBe(0);
    expect(depositFor('restaurant', 4, true, dining)).toBe(20000);
  });

  it('2 no-shows in 60 days → a deposit on the next 3 Restaurant reservations, then off', () => {
    const now = at('12:00', '2026-10-16');
    const noShows = [
      res({
        state: 'no_show',
        createdAt: at('09:00', '2026-09-18'),
        start: at('19:00', '2026-09-20'),
      }),
      res({
        state: 'no_show',
        createdAt: at('09:00', '2026-10-08'),
        start: at('19:00', '2026-10-10'),
      }),
    ];
    expect(repeatNoShowStatus(noShows, now, dining)).toMatchObject({
      required: true,
      remaining: 3,
    });
    const after = [1, 2, 3].map((d) =>
      res({ createdAt: at('09:00', `2026-10-1${d}`), state: 'completed' }),
    );
    expect(repeatNoShowStatus([...noShows, ...after.slice(0, 2)], now, dining)).toMatchObject({
      required: true,
      remaining: 1,
    });
    expect(repeatNoShowStatus([...noShows, ...after], now, dining).required).toBe(false);
  });

  it('no-shows further apart than 60 days don’t trigger it', () => {
    const noShows = [
      res({ state: 'no_show', start: at('19:00', '2026-06-01') }),
      res({ state: 'no_show', start: at('19:00', '2026-10-10') }),
    ];
    expect(repeatNoShowStatus(noShows, NOW, dining).required).toBe(false);
  });

  it('late cancellation is within 24h for PDR/Teppanyaki and 2h for the Restaurant', () => {
    expect(isLateCancellation('teppanyaki', at('21:00'), at('09:00'), dining)).toBe(true);
    expect(isLateCancellation('restaurant', at('21:00'), at('18:30'), dining)).toBe(false);
    expect(isLateCancellation('restaurant', at('21:00'), at('19:30'), dining)).toBe(true);
  });
});

describe('F&B read models', () => {
  const dinner = periodsFor('restaurant', DATE, dining)[2]!;

  it('counts covers booked, seated, no-show and walk-in per period', () => {
    const list = [
      res({ partySize: 4, state: 'seated' }),
      res({ partySize: 2, state: 'no_show' }),
      res({ partySize: 3, state: 'seated', walkIn: true }),
      res({ partySize: 2, start: at('13:00'), period: 'lunch' }),
    ];
    expect(coversFor(list, dinner)).toEqual({ booked: 6, seated: 7, noShow: 2, walkIn: 3 });
  });

  it('forecasts reservations plus the average walk-in rate', () => {
    const pastDinner = periodsFor('restaurant', '2026-10-15', dining)[2]!;
    const list = [
      res({ partySize: 4 }),
      res({ start: at('19:00', '2026-10-15'), partySize: 6, walkIn: true, state: 'completed' }),
    ];
    expect(coversForecast(list, dinner, [pastDinner])).toBe(10);
  });

  it('table states: soon, seated, bill, turning, free', () => {
    const floor = dining.floor;
    const t = tables.find((x) => x.id === 'T4')!;
    expect(tableState(t, [res({ tableIds: ['T4'] })], at('18:40'), floor).state).toBe('soon');
    expect(
      tableState(t, [res({ tableIds: ['T4'], state: 'seated' })], at('19:10'), floor).state,
    ).toBe('seated');
    expect(
      tableState(
        t,
        [res({ tableIds: ['T4'], state: 'seated', billRequestedAt: at('20:00') })],
        at('20:05'),
        floor,
      ).state,
    ).toBe('bill');
    const done = res({
      tableIds: ['T4'],
      state: 'completed',
      bill: { totalFils: 1, settledAt: at('20:10'), method: 'wallet', chargedFils: 1 },
    });
    expect(tableState(t, [done], at('20:20'), floor).state).toBe('turning');
    expect(tableState(t, [done], at('20:30'), floor).state).toBe('free');
  });
});
