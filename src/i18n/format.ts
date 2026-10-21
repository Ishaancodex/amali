/**
 * Locale-aware display formatting (PRD §14): Western digits, dates through
 * date-fns with the Arabic locale, currency "AED 1,250" / "1,250 د.إ".
 * Times are always shown in Asia/Dubai (lib/time).
 */
import { format } from 'date-fns';
import { ar } from 'date-fns/locale/ar';
import { dubaiDateTimeToIso, toDubai } from '@/lib/time';
import { fmtAed } from '@/lib/money';
import type { Locale } from './instances';

export interface Fmt {
  locale: Locale;
  time: (iso: string, pattern?: string) => string;
  date: (iso: string, pattern?: string) => string;
  dateTime: (iso: string, pattern?: string) => string;
  /** A `YYYY-MM-DD` key, without a timezone shifting it a day. */
  dateKey: (dateKey: string, pattern?: string) => string;
  aed: (fils: number) => string;
  num: (n: number, opts?: Intl.NumberFormatOptions) => string;
  pct: (fraction: number, digits?: number) => string;
  /** A weekday name, 0 = Sunday; `EEEE` full, `EEE` short, `EEEEE` narrow. */
  weekday: (day: number, pattern?: string) => string;
  /** A local `Date` (calendar grids), formatted in this locale. */
  local: (date: Date, pattern: string) => string;
}

const cache = new Map<Locale, Fmt>();

export function fmtFor(locale: Locale): Fmt {
  const hit = cache.get(locale);
  if (hit) return hit;
  const opts = locale === 'ar' ? { locale: ar } : undefined;
  const intl = locale === 'ar' ? 'ar-AE-u-nu-latn' : 'en-AE';
  const f = (iso: string, pattern: string) => format(toDubai(iso), pattern, opts);
  const fmt: Fmt = {
    locale,
    time: (iso, pattern = 'HH:mm') => f(iso, pattern),
    date: (iso, pattern = 'EEE d MMM') => f(iso, pattern),
    dateTime: (iso, pattern = 'EEE d MMM · HH:mm') => f(iso, pattern),
    dateKey: (key, pattern = 'd MMM yyyy') => f(dubaiDateTimeToIso(key, '12:00'), pattern),
    aed: (fils) => fmtAed(fils, locale),
    num: (n, o) => new Intl.NumberFormat(intl, o).format(n),
    pct: (fraction, digits = 0) =>
      new Intl.NumberFormat(intl, {
        style: 'percent',
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(fraction),
    // 4–10 Jan 2026 runs Sunday to Saturday.
    weekday: (day, pattern = 'EEEE') =>
      f(dubaiDateTimeToIso(`2026-01-${String(4 + day).padStart(2, '0')}`, '12:00'), pattern),
    local: (date, pattern) => format(date, pattern, opts),
  };
  cache.set(locale, fmt);
  return fmt;
}
