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
import { seasonBands } from '@/store/selectors/programme';
import { CalendarDays } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { buildCalendarDots } from '@/domain/events/calendarDots';
import { dubaiDateKey, toDubai } from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';
import { startOfWeek, endOfWeek } from 'date-fns';
import type { DeviceSlotId } from '@/types/demo';

type ViewTab = 'list' | 'month' | 'year';
const TABS: ViewTab[] = ['list', 'month', 'year'];

export function WhatsOnScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const { pop, push } = useNav(slot);
  const now = useStore((s) => s.demo.clock.now);
  const seasons = useStore((s) => s.seasons);
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
      <TopBar title={t('resident.home.quick.whatsOn')} onBack={pop} />
      <div className="flex gap-1 px-4 pb-3">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`rounded-tag text-label-3 px-3 py-1.5 transition-colors ${
              tab === id ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'
            }`}
          >
            {t(`events.view.${id}`)}
          </button>
        ))}
        {selectedDay && tab === 'list' && (
          <button
            type="button"
            aria-label={t('events.clearDay')}
            onClick={() => setSelectedDay(undefined)}
            className="rounded-tag bg-surface border-border-card text-text-muted text-label-3 border px-3 py-1.5"
          >
            {fmt.dateKey(selectedDay, 'EEE d MMM')} ✕
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
              message={selectedDay ? t('events.nothingThisDay') : t('events.nothingThisWeek')}
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
                        <Tag variant="brand">{t(`amenity.${event.venue}.short`)}</Tag>
                      </div>
                      <p className="text-body-3 text-text-muted mt-0.5">
                        {fmt.date(showtime.start)} · {fmt.time(showtime.start)}–
                        {fmt.time(showtime.end)}
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
          <CalendarYear
            now={now}
            eventDatesByDay={dots}
            bands={seasonBands(seasons)}
            onSelectDay={selectDay}
          />
        )}
      </div>
    </div>
  );
}
