/**
 * Effective operating hours for one calendar date, after date exceptions
 * are applied (PRD §7 check 3: "within operating hours, after date
 * exceptions are applied"). Pure.
 */
import { dubaiWeekday, dubaiDateTimeToIso } from '@/lib/time';
import type { AmenityKey, WeeklyHours, HoursException } from '@/types/amenity';

export interface EffectiveHours {
  open: string; // ISODateTime, this date's opening instant
  close: string; // ISODateTime, this date's closing instant
}

/** `null` means closed all day. */
export function effectiveHoursForDate(
  weeklyHours: readonly WeeklyHours[],
  exceptions: readonly HoursException[],
  amenity: AmenityKey,
  dateKey: string,
): EffectiveHours | null {
  const exception = exceptions.find((e) => e.amenity === amenity && e.date === dateKey);
  if (exception) {
    if (exception.closed) return null;
    if (exception.open && exception.close) {
      return {
        open: dubaiDateTimeToIso(dateKey, exception.open),
        close: dubaiDateTimeToIso(dateKey, exception.close),
      };
    }
  }

  const day = dubaiWeekday(dubaiDateTimeToIso(dateKey, '00:00'));
  const weekly = weeklyHours.find((h) => h.amenity === amenity && h.day === day);
  if (!weekly) return null;
  return {
    open: dubaiDateTimeToIso(dateKey, weekly.open),
    close: dubaiDateTimeToIso(dateKey, weekly.close),
  };
}
