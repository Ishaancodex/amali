/**
 * "Up to 3 nearest valid options (same day first, then the next days)"
 * (PRD §7). Pure — the caller supplies `isOk`, a cheap re-check of
 * checks 2-8 for one candidate start, so this module never duplicates
 * `validate.ts`'s rule logic.
 */
import { addDaysIso, dubaiDateKey } from '@/lib/time';
import { gridStartsForDate } from './slots';

export function findAlternatives(
  requestedStartIso: string,
  isOk: (startIso: string) => boolean,
  opts: { daysToScan?: number; limit?: number } = {},
): string[] {
  const daysToScan = opts.daysToScan ?? 8;
  const limit = opts.limit ?? 3;
  const found: string[] = [];
  const startDateKey = dubaiDateKey(requestedStartIso);

  for (let d = 0; d < daysToScan && found.length < limit; d += 1) {
    const dateKey = dubaiDateKey(addDaysIso(requestedStartIso, d));
    const starts = gridStartsForDate(dateKey).filter(
      (s) => s >= requestedStartIso || dateKey !== startDateKey,
    );
    for (const start of starts) {
      if (found.length >= limit) break;
      if (start === requestedStartIso) continue;
      if (isOk(start)) found.push(start);
    }
  }

  return found;
}
