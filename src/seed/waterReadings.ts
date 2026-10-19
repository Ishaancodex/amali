/**
 * Seven days of pool water readings (PRD §8.5: "every 2 hours while
 * open", "a trend chart shows the last 7 days"), up to `now` —
 * deterministic under `(seed, now)`. Values sit comfortably inside the
 * acceptable bands, apart from one deliberate pH excursion three days ago
 * so the trend chart's shaded band has something visibly outside it.
 * Logged by whichever lifeguard was on shift at the time.
 */
import { rng, rngFloat, seededId } from '@/lib/random';
import { addDaysIso, addHoursIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import { rules } from '@/config/rules';
import { outOfRangeParams } from '@/domain/ops/water';
import { STAFF_IDS } from './personaIds';
import type { WaterReading } from '@/types/ops';

const DAYS = 7;
const EXCURSION_DAYS_AGO = 3;
const EXCURSION_HOUR = '14:00';

function mid(range: { min: number; max: number }): number {
  return (range.min + range.max) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildWaterReadings(seed: string, now: string): Record<string, WaterReading> {
  const r = rng(seed, 'waterReadings');
  const wq = rules.pool.waterQuality;
  const { open, close } = rules.pool.hours;
  const intervalHours = rules.pool.waterReadingIntervalHours;
  const out: Record<string, WaterReading> = {};

  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const dateKey = dubaiDateKey(addDaysIso(now, -daysAgo));
    const closeAt = dubaiDateTimeToIso(dateKey, close);
    // `at < closeAt`, so the last reading is the one before closing (20:00 for a 22:00 close).
    for (
      let at = dubaiDateTimeToIso(dateKey, open);
      at < closeAt && at <= now;
      at = addHoursIso(at, intervalHours)
    ) {
      const isExcursion =
        daysAgo === EXCURSION_DAYS_AGO && at === dubaiDateTimeToIso(dateKey, EXCURSION_HOUR);
      const reading = {
        ph: isExcursion ? round1(wq.ph.max + 0.2) : round1(mid(wq.ph) + rngFloat(r, -0.2, 0.2)),
        freeChlorine: round1(mid(wq.freeChlorinePpm) + rngFloat(r, -0.6, 0.6)),
        tempC: round1(mid(wq.tempC) + rngFloat(r, -1, 1)),
        clarity: 'pass' as const,
      };
      const readingId = seededId(r, 'water');
      out[readingId] = {
        id: readingId,
        createdAt: at,
        updatedAt: at,
        at,
        by:
          at < dubaiDateTimeToIso(dateKey, '14:00')
            ? STAFF_IDS.lifeguardSam
            : STAFF_IDS.lifeguardRahul,
        ...reading,
        outOfRange: outOfRangeParams(reading, wq),
      };
    }
  }
  return out;
}
