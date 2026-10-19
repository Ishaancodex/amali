/**
 * Age bands (PRD §8.3): date of birth sets the band. Under 2 is not
 * accepted; over 12 gets "Teen zone is not supervised". Pure — the band
 * table comes in from `rules.creche`.
 */
import type { AgeBand } from '@/types/creche';

export interface BandRule {
  minAge: number;
  maxAge: number;
  ratioStaffToChildren: number;
}

export type BandTable = Record<AgeBand, BandRule>;

export const BAND_ORDER: readonly AgeBand[] = ['toddlers', 'kids', 'juniors'];

export const BAND_LABEL: Record<AgeBand, string> = {
  toddlers: 'Toddlers',
  kids: 'Kids',
  juniors: 'Juniors',
};

/** Whole years between a `YYYY-MM-DD` date of birth and a `YYYY-MM-DD` date. */
export function ageOnDate(dob: string, dateKey: string): number {
  const [by, bm, bd] = dob.split('-').map(Number) as [number, number, number];
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const hadBirthday = m > bm || (m === bm && d >= bd);
  return y - by - (hadBirthday ? 0 : 1);
}

export type BandResult =
  | { ok: true; band: AgeBand; age: number }
  | { ok: false; reason: 'too_young' | 'too_old'; age: number; message: string };

export function bandForAge(age: number, bands: BandTable, minAcceptedAge: number): BandResult {
  if (age < minAcceptedAge) {
    return {
      ok: false,
      reason: 'too_young',
      age,
      message: `Children under ${minAcceptedAge} are not accepted.`,
    };
  }
  for (const band of BAND_ORDER) {
    const rule = bands[band];
    if (age >= rule.minAge && age <= rule.maxAge) return { ok: true, band, age };
  }
  return { ok: false, reason: 'too_old', age, message: 'Teen zone is not supervised.' };
}

export function bandForChild(
  dob: string,
  dateKey: string,
  bands: BandTable,
  minAcceptedAge: number,
): BandResult {
  return bandForAge(ageOnDate(dob, dateKey), bands, minAcceptedAge);
}
