'use client';

/** Year calendar view (PRD §8.2): 12 mini-months, dots for days with events. */
import { toDubai } from '@/lib/time';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isSameMonth,
  format,
  addMonths,
} from 'date-fns';
import { useFmt } from '@/i18n/hooks';

/** A season shaded across its dates (PRD §8.6: "the season appears as a shaded band"). */
export interface CalendarBand {
  name: string;
  /** Inclusive `YYYY-MM-DD` keys. */
  from: string;
  to: string;
  tone: 'brand' | 'info' | 'success' | 'warning';
}

/** The band covering a date — where seasons overlap (Ramadan inside Winter), the later-starting one wins. */
export function bandOn<B extends { from: string; to: string }>(
  bands: readonly B[] | undefined,
  dateKey: string,
): B | undefined {
  return (bands ?? [])
    .filter((b) => b.from <= dateKey && dateKey <= b.to)
    .reduce<B | undefined>((best, b) => (!best || b.from >= best.from ? b : best), undefined);
}

const BAND_TONE: Record<CalendarBand['tone'], string> = {
  brand: 'bg-brand-tint',
  info: 'bg-info/15',
  success: 'bg-success/15',
  warning: 'bg-warning/20',
};

function MiniMonth({
  monthStart,
  today,
  eventDatesByDay,
  bands,
  onSelectDay,
}: {
  monthStart: Date;
  today: Date;
  eventDatesByDay?: Record<string, number>;
  bands?: CalendarBand[];
  onSelectDay?: (dateKey: string) => void;
}) {
  const days = eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) });
  const leadingBlanks = getDay(startOfMonth(monthStart));
  const fmt = useFmt();

  return (
    <div className="rounded-tile border-border-card border-[0.5px] p-2.5">
      <p className="text-label-3 text-text-title mb-1.5">{fmt.local(monthStart, 'MMMM')}</p>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasEvents = (eventDatesByDay?.[dateKey] ?? 0) > 0;
          const band = bandOn(bands, dateKey);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay?.(dateKey)}
              title={band?.name}
              className={`flex flex-col items-center rounded-sm ${band ? BAND_TONE[band.tone] : ''}`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] tabular-nums ${
                  isSameDay(day, today) && isSameMonth(monthStart, today)
                    ? 'bg-brand text-on-brand'
                    : 'text-text-muted'
                }`}
              >
                {format(day, 'd')}
              </span>
              <span
                className={`h-0.5 w-0.5 rounded-full ${hasEvents ? 'bg-brand' : 'bg-transparent'}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarYear({
  now,
  eventDatesByDay,
  bands,
  rolling,
  onSelectDay,
}: {
  now: string;
  /** DateKey -> count of events that day, for the dot. */
  eventDatesByDay?: Record<string, number>;
  bands?: CalendarBand[];
  /** The next 12 months from this one, instead of the calendar year. */
  rolling?: boolean;
  onSelectDay?: (dateKey: string) => void;
}) {
  const fmt = useFmt();
  const today = toDubai(now);
  const yearStart = rolling
    ? new Date(today.getFullYear(), today.getMonth(), 1)
    : new Date(today.getFullYear(), 0, 1);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  const shown = (bands ?? []).filter((b) => {
    const first = format(months[0]!, 'yyyy-MM-01');
    const last = format(endOfMonth(months[11]!), 'yyyy-MM-dd');
    return b.to >= first && b.from <= last;
  });

  return (
    <div>
      <p className="font-serif-display text-serif-section text-text-title mb-3">
        {rolling
          ? `${fmt.local(months[0]!, 'MMM yyyy')} – ${fmt.local(months[11]!, 'MMM yyyy')}`
          : format(today, 'yyyy')}
      </p>
      {shown.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {shown.map((b) => (
            <span key={b.name} className="text-body-3 text-text-muted flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-sm ${BAND_TONE[b.tone]}`} />
              {b.name}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {months.map((m) => (
          <MiniMonth
            key={m.toISOString()}
            monthStart={m}
            today={today}
            eventDatesByDay={eventDatesByDay}
            bands={shown}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}
