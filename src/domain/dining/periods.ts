/**
 * Service periods and start times per venue (PRD §8.4): the Restaurant on
 * a 15-minute grid within Breakfast/Lunch/Dinner, Private Dining at Lunch
 * and Dinner, Teppanyaki at fixed seatings. During Ramadan (§8.6) Iftar at
 * sunset replaces Lunch. Pure — the rules come in as an argument.
 */
import { addMinutesIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import type { Rules } from '@/config/rules.schema';
import type { ServicePeriod, VenueKey } from '@/types/dining';

type DiningRules = Rules['dining'];

export interface PeriodWindow {
  period: ServicePeriod;
  start: string;
  end: string;
}

export function isRamadan(dateKey: string, dining: DiningRules): boolean {
  return dateKey >= dining.ramadan.start && dateKey <= dining.ramadan.end;
}

export function periodsFor(venue: VenueKey, dateKey: string, dining: DiningRules): PeriodWindow[] {
  const at = (hhmm: string) => dubaiDateTimeToIso(dateKey, hhmm);
  if (venue === 'teppanyaki') {
    const first = dining.teppanyaki.seatings[0]!;
    const last = dining.teppanyaki.seatings.at(-1)!;
    return [
      {
        period: 'dinner',
        start: at(first),
        end: addMinutesIso(at(last), dining.teppanyaki.seatingMinutes),
      },
    ];
  }
  const sp = dining.restaurant.servicePeriods;
  const list: PeriodWindow[] = [];
  if (venue === 'restaurant')
    list.push({ period: 'breakfast', start: at(sp.breakfast.start), end: at(sp.breakfast.end) });
  if (isRamadan(dateKey, dining)) {
    const iftar = at(dining.ramadan.iftarAt);
    list.push({
      period: 'iftar',
      start: iftar,
      end: addMinutesIso(iftar, dining.ramadan.iftarMinutes),
    });
  } else {
    list.push({ period: 'lunch', start: at(sp.lunch.start), end: at(sp.lunch.end) });
  }
  list.push({ period: 'dinner', start: at(sp.dinner.start), end: at(sp.dinner.end) });
  return list;
}

/** How long a party holds its table. */
export function tableMinutes(venue: VenueKey, partySize: number, dining: DiningRules): number {
  if (venue === 'teppanyaki') return dining.teppanyaki.seatingMinutes;
  const r = dining.restaurant;
  return partySize >= r.largePartyThreshold ? r.tableTimeMinutesForLargeParty : r.tableTimeMinutes;
}

/**
 * Bookable start times in a period: Teppanyaki's fixed seatings, Iftar's
 * single sunset sitting, else the grid up to the last start whose table
 * time still ends by the period's close.
 */
export function startTimes(
  venue: VenueKey,
  window: PeriodWindow,
  partySize: number,
  dining: DiningRules,
): string[] {
  if (venue === 'teppanyaki') {
    const dateKey = dubaiDateKey(window.start);
    return dining.teppanyaki.seatings.map((t) => dubaiDateTimeToIso(dateKey, t));
  }
  if (window.period === 'iftar') return [window.start];
  const out: string[] = [];
  const last = addMinutesIso(window.end, -tableMinutes(venue, partySize, dining));
  for (let t = window.start; t <= last; t = addMinutesIso(t, dining.restaurant.startGridMinutes)) {
    out.push(t);
  }
  return out;
}

/** Which period a start time falls in (for a reservation made at an arbitrary time). */
export function periodAt(
  venue: VenueKey,
  dateKey: string,
  start: string,
  dining: DiningRules,
): ServicePeriod | undefined {
  return periodsFor(venue, dateKey, dining).find((p) => p.start <= start && start < p.end)?.period;
}

/**
 * PRD §8.4 edge case: when Iftar replaces Lunch, any lunch reservation
 * already on a Ramadan date is flagged for the team to move.
 */
export function ramadanLunchConflicts<
  R extends { period: ServicePeriod; start: string; state: string },
>(reservations: readonly R[], dining: DiningRules): R[] {
  return reservations.filter(
    (r) =>
      r.period === 'lunch' &&
      (r.state === 'confirmed' || r.state === 'requested') &&
      isRamadan(dubaiDateKey(r.start), dining),
  );
}
