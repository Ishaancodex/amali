/**
 * Time-zone helpers (TRD §5). All times are stored as UTC ISO strings and
 * converted to Asia/Dubai only for display. Never call `new Date()` /
 * `Date.now()` directly outside `scheduler/clock.ts` — use `useDemoClock()`.
 */
import { TZDate } from '@date-fns/tz';
import {
  format,
  addMinutes,
  addHours,
  addDays,
  addMonths,
  addMilliseconds,
  differenceInMinutes,
  differenceInSeconds,
  isBefore,
  isAfter,
  isEqual,
  startOfDay,
  endOfDay,
  parseISO,
} from 'date-fns';

export const DUBAI_TZ = 'Asia/Dubai';

/** Parse a UTC ISO string into a TZDate rendered in Asia/Dubai. */
export function toDubai(iso: string): TZDate {
  return new TZDate(parseISO(iso).getTime(), DUBAI_TZ);
}

/**
 * True UTC ISO string ('...Z') for any Date/TZDate. `TZDate#toISOString()`
 * intentionally returns a zone-offset string (e.g. '+04:00') instead of
 * normalizing to UTC, which would silently break every lexicographic ISO
 * string comparison in the app (scheduler ordering, range checks). Always
 * go through this instead of calling `.toISOString()` directly on a value
 * derived from `toDubai()`.
 */
export function toIso(date: Date): string {
  return new Date(date.getTime()).toISOString();
}

export function fmtTime(iso: string, pattern = 'HH:mm'): string {
  return format(toDubai(iso), pattern);
}

export function fmtDate(iso: string, pattern = 'EEE d MMM'): string {
  return format(toDubai(iso), pattern);
}

export function fmtDateTime(iso: string, pattern = 'EEE d MMM · HH:mm'): string {
  return format(toDubai(iso), pattern);
}

export function fmtDubaiClock(iso: string): string {
  return `${fmtTime(iso)} GST`;
}

/** Day-of-week in Dubai local time, 0 = Sunday .. 6 = Saturday (matches WeeklyHours). */
export function dubaiWeekday(iso: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return toDubai(iso).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** YYYY-MM-DD in Dubai local time — the canonical "date" key used across the store. */
export function dubaiDateKey(iso: string): string {
  return format(toDubai(iso), 'yyyy-MM-dd');
}

export function addMinutesIso(iso: string, minutes: number): string {
  return addMinutes(parseISO(iso), minutes).toISOString();
}

export function addMillisecondsIso(iso: string, ms: number): string {
  return addMilliseconds(parseISO(iso), ms).toISOString();
}

export function addHoursIso(iso: string, hours: number): string {
  return addHours(parseISO(iso), hours).toISOString();
}

export function addDaysIso(iso: string, days: number): string {
  return addDays(parseISO(iso), days).toISOString();
}

export function minutesBetween(a: string, b: string): number {
  return differenceInMinutes(parseISO(b), parseISO(a));
}

export function secondsBetween(a: string, b: string): number {
  return differenceInSeconds(parseISO(b), parseISO(a));
}

export function isBeforeIso(a: string, b: string): boolean {
  return isBefore(parseISO(a), parseISO(b));
}

export function isAfterIso(a: string, b: string): boolean {
  return isAfter(parseISO(a), parseISO(b));
}

export function isEqualIso(a: string, b: string): boolean {
  return isEqual(parseISO(a), parseISO(b));
}

export function isAtOrAfterIso(a: string, b: string): boolean {
  return !isBeforeIso(a, b);
}

export function isAtOrBeforeIso(a: string, b: string): boolean {
  return !isAfterIso(a, b);
}

export function startOfDubaiDay(iso: string): string {
  return toIso(startOfDay(toDubai(iso)));
}

export function endOfDubaiDay(iso: string): string {
  return toIso(endOfDay(toDubai(iso)));
}

/** Combine a Dubai-local date key ('2026-10-15') and 'HH:mm' into a UTC ISO string. */
export function dubaiDateTimeToIso(dateKey: string, hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr ?? 0);
  const m = Number(mStr ?? 0);
  const local = new TZDate(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
    h,
    m,
    0,
    DUBAI_TZ,
  );
  return toIso(local);
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd). */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return isBeforeIso(aStart, bEnd) && isBeforeIso(bStart, aEnd);
}

/** Formats a `YYYY-MM-DD` date key (e.g. a date of birth) without a timezone shifting it a day. */
export function fmtDateKey(dateKey: string, pattern = 'd MMM yyyy'): string {
  return fmtDate(dubaiDateTimeToIso(dateKey, '12:00'), pattern);
}

export function addMonthsIso(iso: string, months: number): string {
  return toIso(addMonths(parseISO(iso), months));
}
