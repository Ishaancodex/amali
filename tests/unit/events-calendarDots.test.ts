import { describe, it, expect } from 'vitest';
import { buildCalendarDots } from '@/domain/events/calendarDots';
import type { ProgrammeEvent, Showtime } from '@/types/event';

const NOW = '2026-01-01T00:00:00.000Z';

function event(id: string, lifecycle: ProgrammeEvent['lifecycle'] = 'published'): ProgrammeEvent {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    title: 'Event',
    venue: 'screening',
    type: 'movie',
    poster: '',
    description: '',
    ageRating: 'PG',
    durationMins: 120,
    pricing: { resident: 0, household: 0, guest_adult: 0, guest_child: 0 },
    lifecycle,
  };
}

function showtime(
  id: string,
  eventId: string,
  start: string,
  state: Showtime['state'] = 'open',
): Showtime {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    eventId,
    start,
    end: start,
    capacityMode: 'seats',
    capacity: 22,
    blockedSeats: [],
    regOpens: NOW,
    regCloses: start,
    state,
  };
}

describe('domain/events/calendarDots', () => {
  it('counts one dot per published, non-cancelled showtime by Dubai calendar date', () => {
    const events = { e1: event('e1') };
    const showtimes = [
      showtime('s1', 'e1', '2026-03-05T20:00:00.000Z'), // 00:00 Dubai next day
      showtime('s2', 'e1', '2026-03-05T18:00:00.000Z'), // 22:00 Dubai same day
    ];
    const dots = buildCalendarDots(events, showtimes);
    expect(dots['2026-03-05']).toBe(1);
    expect(dots['2026-03-06']).toBe(1);
  });

  it('excludes draft/unpublished events and cancelled showtimes', () => {
    const events = { e1: event('e1', 'draft'), e2: event('e2', 'published') };
    const showtimes = [
      showtime('s1', 'e1', '2026-03-05T10:00:00.000Z'),
      showtime('s2', 'e2', '2026-03-05T10:00:00.000Z', 'cancelled'),
    ];
    expect(buildCalendarDots(events, showtimes)).toEqual({});
  });

  it('a full year of showtimes (12 months worth) still resolves quickly (no quadratic blowup)', () => {
    const events: Record<string, ProgrammeEvent> = { e1: event('e1') };
    const showtimes: Showtime[] = [];
    const start = new Date('2026-01-01T06:00:00.000Z').getTime();
    for (let i = 0; i < 800; i += 1) {
      const start_i = new Date(start + i * 11 * 60 * 60 * 1000).toISOString();
      showtimes.push(showtime(`s${i}`, 'e1', start_i));
    }

    const t0 = performance.now();
    const dots = buildCalendarDots(events, showtimes);
    const elapsedMs = performance.now() - t0;

    expect(Object.keys(dots).length).toBeGreaterThan(300);
    // Loose bound (not a tight perf budget) — just catches an accidental O(n^2): single-digit ms
    // on a warm JIT, but CI/dev-machine variance can spike a cold first call well past 50ms.
    expect(elapsedMs).toBeLessThan(500);
  });
});
