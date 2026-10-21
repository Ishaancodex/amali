/**
 * Utilisation and occupancy by amenity, with weekday × hour heatmaps
 * (PRD §8.10). Bookable amenities: booked ÷ bookable minutes (padel: open
 * hours − blackouts; Restaurant: seat-minutes; Screening/Music: seats over
 * the period's showtimes). Pool, gym and Kids' Club: the modelled average
 * headcount ÷ capacity per open hour, zero while closed.
 */
import { rules } from '@/config/rules';
import { effectiveHoursForDate } from '@/domain/booking/hours';
import { periodsFor, tableMinutes } from '@/domain/dining/periods';
import { modelledFraction, type ModelledAmenity } from '@/domain/reports/occupancy';
import {
  averageHeatmap,
  occupancy,
  ratio,
  utilisation,
  utilisationHeatmap,
  type Interval,
} from '@/domain/reports/kpis';
import { addHoursIso, dubaiDateTimeToIso, dubaiWeekday, minutesBetween, toDubai } from '@/lib/time';
import type { AmenityKey } from '@/types/amenity';
import type { HeatmapCell } from '@/types/report';
import type { AppState } from '../types';
import { bookedRows, type ReportRows } from './reportRows';

export interface AmenityUtilisation {
  amenity: AmenityKey;
  kind: 'utilisation' | 'occupancy';
  value: number | undefined;
}

const OCCUPANCY_AMENITIES: readonly AmenityKey[] = ['pool', 'gym', 'creche'];
const hourOf = (iso: string) => toDubai(iso).getHours();

export function utilisationSection(
  s: AppState,
  amenities: AmenityKey[],
  dayKeys: string[],
  rows: ReportRows,
): { utilisationRows: AmenityUtilisation[]; heatmaps: Partial<Record<AmenityKey, HeatmapCell[]>> } {
  const exceptions = Object.values(s.exceptions);
  const inRange = (iso: string) =>
    dayKeys.length > 0 &&
    iso >= dubaiDateTimeToIso(dayKeys[0]!, '00:00') &&
    iso < addHoursIso(dubaiDateTimeToIso(dayKeys.at(-1)!, '00:00'), 24);
  const utilisationRows: AmenityUtilisation[] = [];
  const heatmaps: Partial<Record<AmenityKey, HeatmapCell[]>> = {};
  const restaurantSeats = Object.values(s.tables)
    .filter((t) => t.venue === 'restaurant')
    .reduce((n, t) => n + t.seats, 0);
  for (const a of amenities) {
    if (OCCUPANCY_AMENITIES.includes(a)) {
      const capacity = s.amenities[a]?.capacity ?? 1;
      const samples: { weekday: number; hour: number; value: number }[] = [];
      dayKeys.forEach((dateKey, i) => {
        const h =
          effectiveHoursForDate(s.hours, exceptions, a, dateKey) ??
          (a === 'creche'
            ? {
                open: dubaiDateTimeToIso(dateKey, '09:00'),
                close: dubaiDateTimeToIso(dateKey, '18:00'),
              }
            : undefined);
        if (!h) return;
        const weekday = dubaiWeekday(h.open);
        for (let t = h.open; t < h.close; t = addHoursIso(t, 1)) {
          const closed = s.amenityStatus.some(
            (e) =>
              e.amenity === a &&
              !e.programmeId &&
              (e.status === 'maintenance' || e.status === 'closed' || e.status === 'emergency') &&
              e.from <= t &&
              (!e.to || t < e.to),
          );
          samples.push({
            weekday,
            hour: hourOf(t),
            value:
              modelledFraction(
                a as ModelledAmenity,
                weekday,
                hourOf(t),
                i,
                !closed,
                rules.seedHistory,
              ) * capacity,
          });
        }
      });
      utilisationRows.push({
        amenity: a,
        kind: 'occupancy',
        value: occupancy(
          samples.map((x) => x.value),
          capacity,
        ),
      });
      heatmaps[a] = averageHeatmap(samples.map((x) => ({ ...x, value: x.value / capacity })));
      continue;
    }
    const open: Interval[] = [];
    const slotsBooked: Interval[] = [];
    if (a === 'padel') {
      for (const dateKey of dayKeys) {
        const h = effectiveHoursForDate(s.hours, exceptions, 'padel', dateKey);
        if (h) open.push({ start: h.open, end: h.close });
      }
      slotsBooked.push(...bookedRows(rows, 'padel'));
      const blackouts = Object.values(s.blackouts).filter((b) => b.amenity === 'padel');
      utilisationRows.push({
        amenity: a,
        kind: 'utilisation',
        value: utilisation(slotsBooked, open, blackouts),
      });
      heatmaps[a] = utilisationHeatmap(slotsBooked, open, dubaiWeekday, hourOf);
    } else if (a === 'dining') {
      // Seat-minutes: each party books its seats for its table time; the room offers every seat for each service.
      let bookedSeatMinutes = 0;
      let offeredSeatMinutes = 0;
      for (const dateKey of dayKeys)
        for (const w of periodsFor('restaurant', dateKey, rules.dining))
          offeredSeatMinutes += minutesBetween(w.start, w.end) * restaurantSeats;
      for (const r of bookedRows(rows, 'dining'))
        bookedSeatMinutes += r.seats * tableMinutes('restaurant', r.seats, rules.dining);
      utilisationRows.push({
        amenity: a,
        kind: 'utilisation',
        value: ratio(bookedSeatMinutes, offeredSeatMinutes),
      });
    } else {
      // Showtime venues: seats booked ÷ seats offered across the period's showtimes.
      const shows = Object.values(s.showtimes).filter(
        (st) => inRange(st.start) && st.state !== 'cancelled' && s.events[st.eventId]?.venue === a,
      );
      const offered = shows.reduce((n, st) => n + st.capacity, 0);
      utilisationRows.push({
        amenity: a,
        kind: 'utilisation',
        value: ratio(
          bookedRows(rows, a).reduce((n, r) => n + r.seats, 0),
          offered,
        ),
      });
    }
  }
  return { utilisationRows, heatmaps };
}
