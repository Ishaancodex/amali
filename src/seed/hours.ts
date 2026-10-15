/**
 * Weekly hours for the amenities with simple fixed daily hours (padel,
 * pool, gym — PRD §8.1/§8.5). Screening/Music/Creche/Dining run on
 * sessions/showtimes rather than a single daily open-close, so they're
 * left out of `WeeklyHours` and summarized in their own detail screens.
 */
import type { WeeklyHours } from '@/types/amenity';
import { rules } from '@/config/rules';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function buildWeeklyHours(): WeeklyHours[] {
  const entries: WeeklyHours[] = [];

  for (const day of ALL_DAYS) {
    entries.push({
      amenity: 'padel',
      day,
      open: rules.padel.operatingHours.open,
      close: rules.padel.operatingHours.close,
    });
    entries.push({
      amenity: 'pool',
      day,
      open: rules.pool.hours.open,
      close: rules.pool.hours.close,
    });
    entries.push({ amenity: 'gym', day, open: '00:00', close: '23:59' }); // 24h, staffed window shown separately
  }

  return entries;
}
