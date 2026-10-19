/**
 * A week of staff shifts (TRD §11 volumes: "2 weeks of rosters" — this
 * seeds the week containing `now`, which covers every scenario's demo
 * window; deterministic under `(seed, now)`). One day deliberately gets a
 * real lifeguard gap — PRD §8.5's own example, "No lifeguard 13:30–14:00"
 * — so the coverage-gap UI always has something real to show without a
 * scenario fixture manufacturing it.
 */
import { seededId, rng } from '@/lib/random';
import {
  dubaiDateKey,
  dubaiDateTimeToIso,
  dubaiWeekday,
  startOfDubaiDay,
  addDaysIso,
} from '@/lib/time';
import { STAFF_IDS } from './personaIds';
import type { Shift } from '@/types/ops';
import type { AgeBand } from '@/types/creche';

function shift(
  r: ReturnType<typeof rng>,
  now: string,
  staffId: string,
  dateKey: string,
  startTime: string,
  endTime: string,
  amenity: Shift['amenity'],
  band?: AgeBand,
): Shift {
  return {
    id: seededId(r, 'shift'),
    createdAt: now,
    updatedAt: now,
    staffId,
    date: dateKey,
    start: dubaiDateTimeToIso(dateKey, startTime),
    end: dubaiDateTimeToIso(dateKey, endTime),
    amenity,
    band,
    state: 'scheduled',
  };
}

export function buildShifts(seed: string, now: string): Record<string, Shift> {
  const r = rng(seed, 'shifts');
  const weekStart = addDaysIso(startOfDubaiDay(now), -dubaiWeekday(now)); // this week's Sunday
  const todayKey = dubaiDateKey(now);

  const out: Record<string, Shift> = {};
  const add = (s: Shift) => {
    out[s.id] = s;
  };

  for (let d = 0; d < 7; d += 1) {
    const dateKey = dubaiDateKey(addDaysIso(weekStart, d));
    const isToday = dateKey === todayKey;

    // Pool lifeguards: Sam 06-14, Rahul 14-22 — PRD's own example. Today only, Sam leaves at 13:30,
    // leaving a real 30-minute gap before Rahul's shift starts (PRD §8.5's quoted example gap).
    add(
      shift(r, now, STAFF_IDS.lifeguardSam, dateKey, '06:00', isToday ? '13:30' : '14:00', 'pool'),
    );
    add(shift(r, now, STAFF_IDS.lifeguardRahul, dateKey, '14:00', '22:00', 'pool'));

    // Gym attendant: Leo covers the morning half of the staffed window (06-22) — the one named
    // attendant in the seed, so the afternoon/evening is a real, honest coverage gap too.
    add(shift(r, now, STAFF_IDS.gymLeo, dateKey, '06:00', '14:00', 'gym'));

    // Padel guards: Imran mornings, Joseph afternoons/evenings.
    add(shift(r, now, STAFF_IDS.guardImran, dateKey, '06:00', '14:00', 'padel'));
    add(shift(r, now, STAFF_IDS.guardJoseph, dateKey, '14:00', '23:00', 'padel'));

    // Creche: Maria (Lead) floats across the day; Grace and Aisha staff the Kids band, Fatima
    // Toddlers, Nadia Juniors (PRD §15 S4 seed: "Kids band is staffed by Grace and Aisha").
    // Band capacity itself comes from `bandAssignments` (seed/creche.ts) — a shift here only
    // matters to capacity once it's marked sick.
    add(shift(r, now, STAFF_IDS.crecheMaria, dateKey, '08:30', '18:30', 'creche'));
    add(shift(r, now, STAFF_IDS.crecheGrace, dateKey, '08:45', '18:15', 'creche', 'kids'));
    add(shift(r, now, STAFF_IDS.crecheAisha, dateKey, '08:45', '18:15', 'creche', 'kids'));
    add(shift(r, now, STAFF_IDS.crecheFatima, dateKey, '08:45', '18:15', 'creche', 'toddlers'));
    add(shift(r, now, STAFF_IDS.crecheNadia, dateKey, '08:45', '18:15', 'creche', 'juniors'));
  }

  return out;
}
