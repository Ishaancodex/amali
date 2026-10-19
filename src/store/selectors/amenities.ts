import type { AppState } from '../types';
import type { AmenityKey, AmenityStatus, StatusEntry } from '@/types/amenity';

/**
 * The entry covering `now` — whose `[from, to)` covers it, or the
 * open-ended one if `now` is at or past its `from`. `undefined` means
 * nothing covers `now` (the baseline "open" state, e.g. once a blackout's
 * `to` has passed and nothing has re-opened it yet).
 */
export function selectCurrentStatusEntry(
  state: Pick<AppState, 'amenityStatus'>,
  key: AmenityKey,
  now: string,
): StatusEntry | undefined {
  const covering = state.amenityStatus.filter(
    (e) => e.amenity === key && e.from <= now && (!e.to || now < e.to),
  );
  if (covering.length === 0) return undefined;
  // `>=`, not `>`: two status changes dispatched without the clock moving share a `from`, and the
  // later one (later in the array — entries are only ever pushed) must win.
  return covering.reduce((latest, e) => (e.from >= latest.from ? e : latest));
}

/** Just the status enum — see `selectCurrentStatusEntry` for the reason text too. */
export function selectCurrentStatus(
  state: Pick<AppState, 'amenityStatus'>,
  key: AmenityKey,
  now: string,
): AmenityStatus {
  return selectCurrentStatusEntry(state, key, now)?.status ?? 'open';
}
