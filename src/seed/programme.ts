/**
 * The seeded programme (PRD §8.6, TRD P9): Aqua Aerobics (Tue/Thu
 * 07:00–08:00, pool "Limited: lanes 1–3 reserved"), the Padel Clinic
 * (Sat 08:00–10:00, a recurring court blackout) and the Kids' Music Class
 * (Wed 16:00, 8 spaces, booked like an event); and three seasons — Winter
 * Movie Season (Nov–Feb), Summer Kids' Camp (Jul–Aug) and Ramadan, whose
 * Pool 08:00–20:00 hours clash with the 07:00 Aqua Aerobics (flagged on
 * the calendar). Materialised through the same helpers the commands use,
 * so seeded and console-made series behave identically.
 */
import { rules } from '@/config/rules';
import { SYSTEM_ACTOR } from '@/lib/systemActor';
import { rng } from '@/lib/random';
import {
  addDaysIso,
  dubaiDateKey,
  dubaiDateTimeToIso,
  dubaiWeekday,
  startOfDubaiDay,
} from '@/lib/time';
import { buildRule } from '@/domain/programme/recurrence';
import {
  materialiseProgramme,
  materialiseSeason,
  seasonRange,
} from '@/store/commands/programmeHelpers';
import type { CommandCtx } from '@/store/commands/types';
import type { AppState } from '@/store/types';
import type { ProgrammeItem } from '@/types/programme';
import type { Season } from '@/types/event';

const DAILY = { interval: 1, byWeekday: [], monthlyMode: 'date' as const };

export function seedProgramme(state: AppState, seed: string, now: string): void {
  const ctx = {
    state,
    now,
    actor: SYSTEM_ACTOR,
    rng: rng(seed, 'programme'),
  } as unknown as CommandCtx;
  const weekStart = addDaysIso(startOfDubaiDay(now), -dubaiWeekday(now)); // this week's Sunday
  const on = (weekday: number, hhmm: string) =>
    dubaiDateTimeToIso(dubaiDateKey(addDaysIso(weekStart, weekday)), hhmm);

  const series: Omit<
    ProgrammeItem,
    'createdAt' | 'updatedAt' | 'exdates' | 'overrides' | 'holidayDecisions' | 'state'
  >[] = [
    {
      id: 'prog_aqua',
      title: 'Aqua Aerobics',
      amenity: 'pool',
      effect: 'limited',
      note: 'lanes 1–3 reserved',
      dtstart: on(2, '07:00'),
      rrule: buildRule({ ...DAILY, freq: 'weekly', byWeekday: [2, 4] }, on(2, '07:00')),
      durationMins: 60,
    },
    {
      id: 'prog_padel_clinic',
      title: 'Padel Clinic',
      amenity: 'padel',
      effect: 'blackout',
      dtstart: on(6, '08:00'),
      rrule: buildRule({ ...DAILY, freq: 'weekly', byWeekday: [6] }, on(6, '08:00')),
      durationMins: 120,
    },
    {
      id: 'prog_kids_music',
      title: 'Kids’ Music Class',
      amenity: 'music',
      effect: 'event',
      note: 'Rhythm and singing for ages 4–8.',
      dtstart: on(3, '16:00'),
      rrule: buildRule({ ...DAILY, freq: 'weekly', byWeekday: [3] }, on(3, '16:00')),
      durationMins: 60,
      capacity: 8,
    },
  ];
  for (const s of series) {
    const item: ProgrammeItem = {
      ...s,
      createdAt: now,
      updatedAt: now,
      exdates: [],
      overrides: {},
      holidayDecisions: {},
      state: 'active',
    };
    state.programme[item.id] = item;
    materialiseProgramme(ctx, item);
  }

  const seasons: (Pick<Season, 'id' | 'name' | 'banner' | 'tone' | 'hours'> & {
    from: string;
    to: string;
  })[] = [
    {
      id: 'season_winter_movies',
      name: 'Winter Movie Season',
      banner: 'Classics and family favourites every weekend',
      tone: 'info',
      from: '2026-11-01',
      to: '2027-02-28',
    },
    {
      id: 'season_ramadan',
      name: 'Ramadan',
      banner: 'Ramadan Kareem — Iftar at the Restaurant, pool 08:00–20:00',
      tone: 'warning',
      from: rules.dining.ramadan.start,
      to: rules.dining.ramadan.end,
      hours: [{ amenity: 'pool', open: '08:00', close: '20:00' }],
    },
    {
      id: 'season_summer_camp',
      name: 'Summer Kids’ Camp',
      banner: 'Daily camp for ages 5–12',
      tone: 'success',
      from: '2027-07-01',
      to: '2027-08-31',
    },
  ];
  for (const s of seasons) {
    const range = seasonRange(s.from, s.to);
    const season: Season = {
      id: s.id,
      createdAt: now,
      updatedAt: now,
      name: s.name,
      banner: s.banner,
      tone: s.tone,
      start: range.start,
      end: range.end,
      hoursOverrides: [],
      hours: s.hours ?? [],
    };
    state.seasons[season.id] = season;
    materialiseSeason(ctx, season);
  }
}
