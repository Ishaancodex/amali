'use client';

/**
 * What's On (PRD §6.1, §8.2): List view (this week, or a tapped day) |
 * Calendar view (month/year, with dots). Tapping a dot-day switches to
 * the List view filtered to that day — the "day tap behaviour" PRD §8.2
 * asks for.
 */
import { useMemo, useState } from 'react';
import { ScreenShell } from '@/ui/ScreenShell';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { Rise } from '@/ui/Rise';
import { Photo } from '@/ui/Photo';
import { Eyebrow } from '@/ui/Eyebrow';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
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
    <ScreenShell
      eyebrow={t('resident.whatsOn.eyebrow')}
      title={t('resident.home.quick.whatsOn')}
      onBack={pop}
      image="/stock/whats-on.jpg"
      bodyClassName="gap-5"
    >
      <SegmentedTabs
        items={TABS.map((id) => ({ id, label: t(`events.view.${id}`) }))}
        value={tab}
        onChange={setTab}
      />
      {selectedDay && tab === 'list' && (
        <button
          type="button"
          aria-label={t('events.clearDay')}
          onClick={() => setSelectedDay(undefined)}
          className="rounded-tag bg-surface border-border-card text-text-muted text-label-3 self-start border px-3 py-1.5"
        >
          {fmt.dateKey(selectedDay, 'EEE d MMM')} ✕
        </button>
      )}
      {tab === 'list' &&
        (status === 'loading' ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="rounded-tile h-24" />
            ))}
          </div>
        ) : listed.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            message={selectedDay ? t('events.nothingThisDay') : t('events.nothingThisWeek')}
          />
        ) : (
          <div className="flex flex-col">
            {listed.map((showtime, i) => {
              const event = events[showtime.eventId];
              if (!event) return null;
              return (
                <Rise key={showtime.id} i={i}>
                  <button
                    type="button"
                    onClick={() =>
                      push('event-detail', { eventId: event.id, showtimeId: showtime.id })
                    }
                    className="border-border-card flex w-full items-center gap-4 border-b-[0.5px] py-3.5 text-start last:border-b-0"
                  >
                    <Photo
                      src={event.poster}
                      className="rounded-card-image h-[4.5rem] w-16 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <Eyebrow className="text-brand block">
                        {fmt.date(showtime.start)} · {fmt.time(showtime.start)}–
                        {fmt.time(showtime.end)}
                      </Eyebrow>
                      <p className="font-serif-display text-serif-section text-text-title mt-1">
                        {event.title}
                      </p>
                      <p className="text-body-3 text-text-muted mt-0.5">
                        {t(`amenity.${event.venue}.name`)}
                      </p>
                    </div>
                  </button>
                </Rise>
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
    </ScreenShell>
  );
}
