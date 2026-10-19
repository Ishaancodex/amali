/**
 * Duplicate-incident detection (PRD §8.5 edge case: "same amenity and
 * category within 2h suggests 'Merge with INC-0142?'"). Pure.
 */
import { addHoursIso } from '@/lib/time';
import type { Incident } from '@/types/ops';

export function findDuplicateIncident(
  incidents: readonly Incident[],
  amenity: Incident['amenity'],
  category: string,
  at: string,
  windowHours = 2,
): Incident | undefined {
  const windowStart = addHoursIso(at, -windowHours);
  return incidents.find(
    (i) =>
      i.amenity === amenity &&
      i.category === category &&
      !i.mergedInto &&
      i.at >= windowStart &&
      i.at <= at,
  );
}
