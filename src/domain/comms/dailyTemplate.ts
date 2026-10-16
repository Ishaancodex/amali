/**
 * The "Daily amenity update" template (PRD §8.7): pre-fills the composer
 * from live amenity statuses and today's hours. A best-effort summary —
 * the PRD's example line also quotes live occupancy/seats-left figures
 * that would need deep per-amenity queries; this sticks to status + hours,
 * which is what every amenity already exposes, and leaves the manager to
 * add specifics before sending (PRD: "the manager edits it if needed").
 */
import { dubaiWeekday } from '@/lib/time';
import type { Amenity, AmenityKey, AmenityStatus, StatusEntry, WeeklyHours } from '@/types/amenity';

const STATUS_LABEL: Record<AmenityStatus, string> = {
  open: 'open',
  limited: 'limited',
  closed: 'closed',
  maintenance: 'maintenance',
  emergency: 'closed (emergency)',
};

export interface DailyTemplateContext {
  amenities: Record<string, Amenity>;
  amenityStatus: readonly StatusEntry[];
  hours: readonly WeeklyHours[];
  now: string;
}

/** Mirrors `store/selectors/amenities.ts#selectCurrentStatus` — duplicated rather than imported, since `domain/*` may not import from `store/*` (CLAUDE.md layering rule). */
function statusAt(
  amenityStatus: readonly StatusEntry[],
  key: AmenityKey,
  now: string,
): AmenityStatus {
  const covering = amenityStatus.filter(
    (e) => e.amenity === key && e.from <= now && (!e.to || now < e.to),
  );
  if (covering.length === 0) return 'open';
  return covering.reduce((latest, e) => (e.from > latest.from ? e : latest)).status;
}

export function buildDailyUpdateText(ctx: DailyTemplateContext): string {
  const weekday = dubaiWeekday(ctx.now);
  const lines = Object.values(ctx.amenities).map((amenity) => {
    const status = statusAt(ctx.amenityStatus, amenity.key, ctx.now);
    const todaysHours = ctx.hours.find((h) => h.amenity === amenity.key && h.day === weekday);
    const hoursText =
      status === 'open' && todaysHours ? ` ${todaysHours.open}–${todaysHours.close}` : '';
    return `${amenity.name}: ${STATUS_LABEL[status]}${hoursText}`;
  });
  return `Good morning, Amali. Today: ${lines.join(' · ')}.`;
}
