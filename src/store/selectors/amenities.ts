import type { AppState } from '../types';
import type { AmenityKey, AmenityStatus } from '@/types/amenity';

/** The amenity's current status: the most recent entry with no `to` (or the latest `from`). */
export function selectCurrentStatus(
  state: Pick<AppState, 'amenityStatus'>,
  key: AmenityKey,
): AmenityStatus {
  const entries = state.amenityStatus.filter((e) => e.amenity === key);
  if (entries.length === 0) return 'open';
  const ongoing = entries.find((e) => !e.to);
  if (ongoing) return ongoing.status;
  return entries.reduce((latest, e) => (e.from > latest.from ? e : latest)).status;
}
