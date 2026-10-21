import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import { schedulerEngine } from '@/scheduler/engine';
import { buildSeed } from '@/seed';
import { PERSONA_IDS, STAFF_IDS } from '@/seed/personaIds';
import { dubaiDateTimeToIso, fmtTime } from '@/lib/time';
import { slotOptions } from '@/domain/booking/slots';
import { effectiveHoursForDate } from '@/domain/booking/hours';
import { buildRule, expandOccurrences, parseRule } from '@/domain/programme/recurrence';
import { editAll, editThisAndFollowing, editThisOccurrence } from '@/domain/programme/editScope';
import { programmeConflicts, upcomingOccurrences } from '@/store/selectors/programme';
import { selectCurrentStatusEntry } from '@/store/selectors/amenities';
import type { ProgrammeItem } from '@/types/programme';

const NOW = '2026-10-14T13:30:00.000Z'; // Wed 14 Oct, 17:30 Dubai
const at = (date: string, hhmm: string) => dubaiDateTimeToIso(date, hhmm);
const hana = { kind: 'staff' as const, id: STAFF_IDS.cmHana, role: 'community_manager' };
const layla = { kind: 'resident' as const, id: PERSONA_IDS.layla };
const s = () => useStore.getState();
const dispatch: ReturnType<typeof s>['dispatch'] = (...args) => s().dispatch(...args);

function reset(now = NOW) {
  useStore.setState(buildSeed('amali-2026', now));
  schedulerEngine.queue.clear();
}

function series(over: Partial<ProgrammeItem> = {}): ProgrammeItem {
  const dtstart = at('2026-10-13', '07:00'); // Tue
  return {
    id: 'p1',
    createdAt: NOW,
    updatedAt: NOW,
    title: 'Class',
    amenity: 'pool',
    effect: 'limited',
    rrule: buildRule(
      { freq: 'weekly', interval: 1, byWeekday: [2, 4], monthlyMode: 'date', count: 6 },
      dtstart,
    ),
    dtstart,
    durationMins: 60,
    exdates: [],
    overrides: {},
    holidayDecisions: {},
    state: 'active',
    ...over,
  };
}
const all = (item: ProgrammeItem) =>
  expandOccurrences(item, '2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z');

describe('recurrence', () => {
  it('builds and parses weekly, monthly-by-weekday and daily rules', () => {
    const dt = at('2026-10-14', '16:00'); // 2nd Wed
    expect(
      parseRule(
        buildRule(
          {
            freq: 'weekly',
            interval: 2,
            byWeekday: [6],
            monthlyMode: 'date',
            untilDate: '2026-12-31',
          },
          dt,
        ),
      ),
    ).toMatchObject({ freq: 'weekly', interval: 2, byWeekday: [6], untilDate: '2026-12-31' });
    const monthly = buildRule(
      { freq: 'monthly', interval: 1, byWeekday: [], monthlyMode: 'weekday', count: 3 },
      dt,
    );
    expect(all(series({ rrule: monthly, dtstart: dt })).map((o) => o.start)).toEqual([
      at('2026-10-14', '16:00'),
      at('2026-11-11', '16:00'),
      at('2026-12-09', '16:00'),
    ]);
    expect(
      all(
        series({
          rrule: buildRule(
            { freq: 'daily', interval: 1, byWeekday: [], monthlyMode: 'date', count: 3 },
            dt,
          ),
          dtstart: dt,
        }),
      ),
    ).toHaveLength(3);
  });

  it('honours exdates and overrides', () => {
    const item = series({
      exdates: [at('2026-10-15', '07:00')],
      overrides: {
        [at('2026-10-20', '07:00')]: {
          start: at('2026-10-20', '09:00'),
          end: at('2026-10-20', '10:00'),
        },
      },
    });
    const occ = all(item);
    expect(occ).toHaveLength(5);
    expect(occ.find((o) => o.originalStart === at('2026-10-20', '07:00'))).toMatchObject({
      start: at('2026-10-20', '09:00'),
      overridden: true,
    });
  });
});

describe('edit scopes', () => {
  it('this occurrence: moves one, or deletes one, leaving the rule', () => {
    const moved = editThisOccurrence(series(), at('2026-10-15', '07:00'), { startTime: '08:30' });
    expect(all(moved).find((o) => o.originalStart === at('2026-10-15', '07:00'))?.start).toBe(
      at('2026-10-15', '08:30'),
    );
    expect(moved.rrule).toBe(series().rrule);
    expect(
      all(editThisOccurrence(series(), at('2026-10-15', '07:00'), { delete: true })),
    ).toHaveLength(5);
  });

  it('this and following: splits the series and carries what is left of the COUNT', () => {
    const { head, tail } = editThisAndFollowing(
      series(),
      at('2026-10-20', '07:00'),
      { startTime: '08:00' },
      'p2',
      NOW,
    );
    expect(all(head).map((o) => fmtTime(o.start))).toEqual(['07:00', '07:00']);
    expect(all(tail!).map((o) => o.start)).toEqual([
      at('2026-10-20', '08:00'),
      at('2026-10-22', '08:00'),
      at('2026-10-27', '08:00'),
      at('2026-10-29', '08:00'),
    ]);
    expect(
      editThisAndFollowing(series(), at('2026-10-20', '07:00'), { delete: true }, 'p2', NOW).tail,
    ).toBeUndefined();
  });

  it('all: re-times every occurrence and drops one-off moves', () => {
    const moved = editThisOccurrence(series(), at('2026-10-15', '07:00'), { startTime: '08:30' });
    const all8 = editAll(moved, { startTime: '08:00' }, NOW);
    expect(new Set(all(all8).map((o) => fmtTime(o.start)))).toEqual(new Set(['08:00']));
    expect(all8.overrides).toEqual({});
  });
});

describe('seeded programme', () => {
  beforeEach(() => reset());

  it('the Padel Clinic removes Saturday 08:00–10:00 slots', () => {
    const blackouts = Object.values(s().blackouts);
    const slots = slotOptions({
      dateKey: '2026-10-17',
      durationMinutes: 60,
      earliestBookable: NOW,
      bookings: [],
      blackouts,
    });
    const closed = slots.filter((o) => !o.bookable).map((o) => fmtTime(o.start));
    expect(closed).toEqual(['07:30', '08:00', '08:30', '09:00', '09:30']);
    expect(slots.find((o) => fmtTime(o.start) === '10:00')?.bookable).toBe(true);
    const r = dispatch(
      'booking.bookNow',
      { start: at('2026-10-17', '08:30'), durationMinutes: 60, players: [] },
      layla,
    );
    expect(!r.ok && r.error.code).toBe('BLACKOUT');
  });

  it('Aqua Aerobics shows the pool as Limited during class — but never over a closure', () => {
    expect(selectCurrentStatusEntry(s(), 'pool', at('2026-10-15', '07:30'))?.reason).toBe(
      'Aqua Aerobics — lanes 1–3 reserved',
    );
    expect(
      selectCurrentStatusEntry(s(), 'pool', at('2026-10-15', '08:30'))?.programmeId,
    ).toBeUndefined();
    s().dispatch(
      'amenity.setStatus',
      { amenity: 'pool', status: 'closed', reason: 'Repairs' },
      hana,
    );
    useStore.setState((d) => {
      d.demo.clock.now = at('2026-10-15', '07:30');
    });
    expect(selectCurrentStatusEntry(s(), 'pool', at('2026-10-15', '07:30'))?.status).toBe('closed');
  });

  it('the Kids’ Music Class is 8 bookable spaces every Wednesday', () => {
    const shows = Object.values(s().showtimes).filter((x) => x.programmeId === 'prog_kids_music');
    expect(shows.length).toBeGreaterThan(50);
    expect(shows[0]).toMatchObject({ capacity: 8, capacityMode: 'headcount' });
  });

  it('Ramadan sets pool hours 08:00–20:00 and flags the 07:00 Aqua Aerobics, suggesting 08:00', () => {
    const h = effectiveHoursForDate(s().hours, Object.values(s().exceptions), 'pool', '2027-02-16');
    expect([fmtTime(h!.open), fmtTime(h!.close)]).toEqual(['08:00', '20:00']);
    const clash = programmeConflicts(s(), s().programme.prog_aqua!, NOW).hours;
    expect(clash.length).toBeGreaterThanOrEqual(8);
    expect(
      clash.every(
        (c) =>
          c.occurrence.start >= at('2027-02-08', '00:00') &&
          c.occurrence.start <= at('2027-03-09', '23:59'),
      ),
    ).toBe(true);
    expect(fmtTime(clash[0]!.suggestedStart!)).toBe('08:00');
  });

  it('a new season reports the classes its hours clash with', () => {
    const r = dispatch(
      'season.create',
      {
        name: 'Winter hours',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        banner: '',
        hours: [{ amenity: 'pool', open: '08:00', close: '20:00' }],
      },
      hana,
    );
    expect(r.ok && r.value.clashes).toEqual([
      expect.objectContaining({ title: 'Aqua Aerobics', occurrences: 8 }),
    ]);
  });

  it('a public holiday on a class day is listed; Skip removes that class', () => {
    const holidays = programmeConflicts(s(), s().programme.prog_aqua!, NOW).holidays;
    expect(holidays.map((h) => h.date)).toEqual(
      expect.arrayContaining(['2026-12-01', '2026-12-03']),
    );
    dispatch(
      'programme.decideHoliday',
      { programmeId: 'prog_aqua', date: '2026-12-01', decision: 'skip' },
      hana,
    );
    expect(
      s().amenityStatus.some(
        (e) => e.programmeId === 'prog_aqua' && e.from === at('2026-12-01', '07:00'),
      ),
    ).toBe(false);
  });
});

describe('saving with conflicts', () => {
  beforeEach(() => reset());
  const rule = (d: number, dt: string) =>
    buildRule({ freq: 'weekly', interval: 1, byWeekday: [d], monthlyMode: 'date' }, dt);

  it('a clinic over existing padel bookings needs a handling choice, then displaces them', () => {
    const booked = dispatch(
      'booking.bookNow',
      { start: at('2026-10-20', '18:00'), durationMinutes: 60, players: [] },
      layla,
    );
    expect(booked.ok).toBe(true);
    const input = {
      title: 'Evening Clinic',
      amenity: 'padel' as const,
      effect: 'blackout' as const,
      dtstart: at('2026-10-20', '18:00'),
      rrule: rule(2, at('2026-10-20', '18:00')),
      durationMins: 60,
    };
    const blocked = dispatch('programme.create', input, hana);
    expect(!blocked.ok && blocked.error.params).toMatchObject({ bookings: 1 });
    const saved = dispatch(
      'programme.create',
      { ...input, handling: 'cancel_priority_rebook' },
      hana,
    );
    expect(saved.ok && saved.value.displacedBookings).toBe(1);
    expect(s().bookings[booked.ok ? booked.value.id : '']?.state).toBe('cancelled_by_ops');
  });

  it('a class clashing with another in the same venue is refused — or saved skipping those dates', () => {
    const input = {
      title: 'Choir',
      amenity: 'music' as const,
      effect: 'event' as const,
      dtstart: at('2026-10-21', '16:30'),
      rrule: rule(3, at('2026-10-21', '16:30')),
      durationMins: 60,
      capacity: 10,
    };
    const r = dispatch('programme.create', input, hana);
    expect(!r.ok && r.error.code).toBe('VENUE_CONFLICT');
    const skipped = dispatch('programme.create', { ...input, skipConflicts: true }, hana);
    expect(skipped.ok && skipped.value.occurrences).toBe(0);
  });

  it('editing all re-materialises; deleting a booked class occurrence cancels its bookings', () => {
    const show = Object.values(s().showtimes).find(
      (x) => x.programmeId === 'prog_kids_music' && x.start === at('2026-10-21', '16:00'),
    )!;
    const rsvp = dispatch(
      'rsvp.bookNow',
      { showtimeId: show.id, attendees: [{ category: 'resident', name: 'Layla' }] },
      layla,
    );
    expect(rsvp.ok).toBe(true);
    dispatch(
      'programme.edit',
      {
        programmeId: 'prog_kids_music',
        originalStart: show.start,
        scope: 'this',
        change: { delete: true },
      },
      hana,
    );
    expect(s().showtimes[show.id]?.state).toBe('cancelled');
    expect(s().rsvps[rsvp.ok ? rsvp.value.id : '']?.state).toBe('cancelled');
    dispatch(
      'programme.edit',
      {
        programmeId: 'prog_aqua',
        originalStart: at('2026-10-15', '07:00'),
        scope: 'all',
        change: { startTime: '08:00' },
      },
      hana,
    );
    expect(
      upcomingOccurrences(s().programme.prog_aqua!, NOW).every((o) => fmtTime(o.start) === '08:00'),
    ).toBe(true);
    expect(selectCurrentStatusEntry(s(), 'pool', at('2026-10-15', '08:30'))?.programmeId).toBe(
      'prog_aqua',
    );
  });

  it('this and following leaves one series ending before and a new one starting at the edit', () => {
    const r = dispatch(
      'programme.edit',
      {
        programmeId: 'prog_padel_clinic',
        originalStart: at('2026-10-31', '08:00'),
        scope: 'following',
        change: { startTime: '09:00' },
      },
      hana,
    );
    expect(r.ok && r.value.items).toHaveLength(2);
    const [head, tail] = r.ok ? r.value.items : [];
    expect(upcomingOccurrences(head!, NOW).at(-1)?.start).toBe(at('2026-10-24', '08:00'));
    expect(upcomingOccurrences(tail!, NOW)[0]?.start).toBe(at('2026-10-31', '09:00'));
    expect(s().blackouts[`pblk_${head!.id}_${at('2026-10-31', '08:00')}`]).toBeUndefined();
  });
});
