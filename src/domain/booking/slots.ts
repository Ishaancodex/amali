/**
 * Padel slot-grid math (PRD §7, §8.1): resource keys, the 30-minute start
 * grid, and range overlap. Pure — no store, no `new Date()`.
 */
import { addMinutesIso, rangesOverlap, dubaiDateTimeToIso, fmtTime } from '@/lib/time';
import { rules } from '@/config/rules';
import type { AmenityKey } from '@/types/amenity';

/** 'padel:2026-10-15T13:00:00.000Z' — one hard-capacity-1 court, so the amenity key alone keys the resource. */
export function resourceKey(amenity: AmenityKey, startIso: string): string {
  return `${amenity}:${startIso}`;
}

/** The inverse of `resourceKey` — pulls the ISO start back out of `'<amenity>:<ISO start>'`. */
export function resourceKeyStart(key: string): string {
  return key.slice(key.indexOf(':') + 1);
}

export function slotEnd(startIso: string, durationMinutes: number): string {
  return addMinutesIso(startIso, durationMinutes);
}

export function slotsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return rangesOverlap(aStart, aEnd, bStart, bEnd);
}

/** Every 30-minute grid start for `dateKey` (00:00 to 23:30 Dubai-local), as UTC ISO strings. */
export function gridStartsForDate(dateKey: string): string[] {
  const starts: string[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      starts.push(
        dubaiDateTimeToIso(dateKey, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
      );
    }
  }
  return starts;
}

/**
 * The 30-minute grid cells a [start, start+durationMinutes) booking spans —
 * e.g. a 90-minute booking at 17:00 spans 17:00/17:30/18:00. Holds are
 * stored one-per-cell (`resourceKey`) since `Hold` has no duration field,
 * so this is what both creates and conflict-checks a multi-cell hold.
 */
export function occupiedGridCells(startIso: string, durationMinutes: number): string[] {
  const cells: string[] = [];
  for (let offset = 0; offset < durationMinutes; offset += rules.padel.slotGridMinutes) {
    cells.push(addMinutesIso(startIso, offset));
  }
  return cells;
}

/** PRD §8.1 peak window: 18:00-22:00 local, by clock time only (any day). */
export function isPeakStart(startIso: string): boolean {
  const hhmm = fmtTime(startIso);
  return hhmm >= rules.padel.quota.peakHours.start && hhmm < rules.padel.quota.peakHours.end;
}
