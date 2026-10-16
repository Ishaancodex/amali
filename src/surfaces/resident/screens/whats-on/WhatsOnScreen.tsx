'use client';

/**
 * What's On (PRD §6.1, §8.2): List view (this week, or a tapped day) |
 * Calendar view (month/year, with dots). Tapping a dot-day switches to
 * the List view filtered to that day — the "day tap behaviour" PRD §8.2
 * asks for.
 */
import { useMemo, useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { Tag } from '@/ui/Tag';
import { CalendarMonth } from '@/ui/Calendar/Month';
import { CalendarYear } from '@/ui/Calendar/Year';
import { CalendarDays } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { buildCalendarDots } from '@/domain/events/calendarDots';
import { dubaiDateKey, fmtDate, fmtTime, toDubai } from '@/lib/time';
import { startOfWeek, endOfWeek } from 'date-fns';
import type { DeviceSlotId } from '@/types/demo';

type ViewTab = 'list' | 'month' | 'year';
const TABS: { id: ViewTab; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export function WhatsOnScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop, push } = useNav(slot);
  const now = useStore((s) => s.demo.clock.now);
  const events = useStore((s) => s.events);
  const showtimes = useStore((s) => s.showtimes);
  const [tab, setTab] = useState<ViewTab>('list');
  const [selectedDay, setSelectedDay] = useState<string | undefined>(undefined);

  const { status, data: publishedShowtimes } = useSimulatedQuery('whats-on-showtimes', () =>
    Object.values(showtimes)
      .filter((sh) => sh.state !== 'cancelled' && events[sh.eventId]?.lifecycle === 'published')
      .sort((a, b) => a.start.localeCompare(b.start)),
  );

  const dots = useMemo(
    () => buildCalendarDots(events, publishedShowtimes),
    [events, publishedShowtimes],
  );

  const weekStart = startOfWeek(toDubai(now));
  const weekEnd = endOfWeek(toDubai(now));
  const listed = selectedDay
    ? publishedShowtimes.filter((sh) => dubaiDateKey(sh.start) === selectedDay)
    : publishedShowtimes.filter((sh) => {
        const d = toDubai(sh.start);
        return d >= weekStart && d <= weekEnd;
      });

  function selectDay(dateKey: string) {
    setSelectedDay(dateKey);
    setTab('list');
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title="What's On" onBack={pop} />
      <div className="flex gap-1 px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-tag text-label-3 px-3 py-1.5 transition-colors ${
              tab === t.id ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'
            }`}
          >
            {t.label}
          </button>
        ))}
        {selectedDay && tab === 'list' && (
          <button
            type="button"
            onClick={() => setSelectedDay(undefined)}
            className="rounded-tag bg-surface border-border-card text-text-muted text-label-3 border px-3 py-1.5"
          >
            {fmtDate(`${selectedDay}T12:00:00.000Z`, 'EEE d MMM')} ✕
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {tab === 'list' &&
          (status === 'loading' ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : listed.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              message={
                selectedDay ? 'Nothing on this day.' : 'Nothing on this week yet. Check back soon.'
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {listed.map((showtime) => {
                const event = events[showtime.eventId];
                if (!event) return null;
                return (
                  <button
                    key={showtime.id}
                    type="button"
                    onClick={() =>
                      push('event-detail', { eventId: event.id, showtimeId: showtime.id })
                    }
                    className="rounded-card border-border-card bg-surface flex gap-3 border-[0.5px] p-3 text-start"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={event.poster} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-label-2 text-text-title truncate">{event.title}</span>
                        <Tag variant="brand">
                          {event.venue === 'screening' ? 'Screening' : 'Music'}
                        </Tag>
                      </div>
                      <p className="text-body-3 text-text-muted mt-0.5">
                        {fmtDate(showtime.start)} · {fmtTime(showtime.start)}–
                        {fmtTime(showtime.end)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        {tab === 'month' && (
          <CalendarMonth now={now} eventDatesByDay={dots} onSelectDay={selectDay} />
        )}
        {tab === 'year' && (
          <CalendarYear now={now} eventDatesByDay={dots} onSelectDay={selectDay} />
        )}
      </div>
    </div>
  );
}
