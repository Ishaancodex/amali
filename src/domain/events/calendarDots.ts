/**
 * What's On month/year calendar dots (PRD §8.2: "Month view: dots per day
 * ... Year view: 12 mini-months, with dots showing days that have
 * events"). A single O(showtimes) pass, deliberately — this is what the
 * year view calls on every render, and P4's exit criteria require the
 * year view to stay fast even with a full programme loaded. Seasonal
 * shading (P9) is out of scope here.
 */
import { dubaiDateKey } from '@/lib/time';
import type { ProgrammeEvent, Showtime } from '@/types/event';

export function buildCalendarDots(
  events: Record<string, ProgrammeEvent>,
  showtimes: readonly Showtime[],
): Record<string, number> {
  const dots: Record<string, number> = {};
  for (const showtime of showtimes) {
    const event = events[showtime.eventId];
    if (!event || event.lifecycle !== 'published' || showtime.state === 'cancelled') continue;
    const dateKey = dubaiDateKey(showtime.start);
    dots[dateKey] = (dots[dateKey] ?? 0) + 1;
  }
  return dots;
}
