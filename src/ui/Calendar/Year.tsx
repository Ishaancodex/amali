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

function MiniMonth({
  monthStart,
  today,
  eventDatesByDay,
  onSelectDay,
}: {
  monthStart: Date;
  today: Date;
  eventDatesByDay?: Record<string, number>;
  onSelectDay?: (dateKey: string) => void;
}) {
  const days = eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) });
  const leadingBlanks = getDay(startOfMonth(monthStart));

  return (
    <div className="rounded-card border-border-card border-[0.5px] p-2.5">
      <p className="text-label-3 text-text-title mb-1.5">{format(monthStart, 'MMMM')}</p>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const hasEvents = (eventDatesByDay?.[dateKey] ?? 0) > 0;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay?.(dateKey)}
              className="flex flex-col items-center"
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
  onSelectDay,
}: {
  now: string;
  /** DateKey -> count of events that day, for the dot. */
  eventDatesByDay?: Record<string, number>;
  onSelectDay?: (dateKey: string) => void;
}) {
  const today = toDubai(now);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));

  return (
    <div>
      <p className="text-label-1 text-text-title mb-3">{format(today, 'yyyy')}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {months.map((m) => (
          <MiniMonth
            key={m.toISOString()}
            monthStart={m}
            today={today}
            eventDatesByDay={eventDatesByDay}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}
