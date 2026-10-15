import type { AppState } from '../types';
import type { AmenityKey, AmenityStatus } from '@/types/amenity';

/**
 * The amenity's status at `now`: the entry whose `[from, to)` covers it
 * (or the open-ended one, if `now` is at or past its `from`). Falls back
 * to 'open' when nothing covers `now` — the baseline state outside any
 * explicit status entry (e.g. once a blackout's `to` has passed and
 * nothing has re-opened it yet).
 */
export function selectCurrentStatus(
  state: Pick<AppState, 'amenityStatus'>,
  key: AmenityKey,
  now: string,
): AmenityStatus {
  const covering = state.amenityStatus.filter(
    (e) => e.amenity === key && e.from <= now && (!e.to || now < e.to),
  );
  if (covering.length === 0) return 'open';
  return covering.reduce((latest, e) => (e.from > latest.from ? e : latest)).status;
}
