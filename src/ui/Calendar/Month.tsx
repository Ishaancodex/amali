'use client';

/** Month calendar view (PRD §8.2 "Month view: dots per day, coloured by venue"). */
import { toDubai } from '@/lib/time';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from 'date-fns';
import { useFmt } from '@/i18n/hooks';

export function CalendarMonth({
  now,
  eventDatesByDay,
  onSelectDay,
}: {
  now: string;
  /** DateKey -> count of events that day, for the dot. */
  eventDatesByDay?: Record<string, number>;
  onSelectDay?: (dateKey: string) => void;
}) {
  const fmt = useFmt();
  const today = toDubai(now);
  const monthStart = startOfMonth(today);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(endOfMonth(today));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div>
      <p className="text-label-1 text-text-title mb-3">{fmt.local(today, 'MMMM yyyy')}</p>
      <div className="grid grid-cols-7 gap-y-2 text-center">
        {days.slice(0, 7).map((d) => (
          <span key={d.toISOString()} className="text-body-3 text-text-muted">
            {fmt.local(d, 'EEEEE')}
          </span>
        ))}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const count = eventDatesByDay?.[dateKey] ?? 0;
          const inMonth = isSameMonth(day, today);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={dateKey}
              type="button"
              disabled={!inMonth}
              onClick={() => onSelectDay?.(dateKey)}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <span
                className={`text-body-3 flex h-7 w-7 items-center justify-center rounded-full tabular-nums ${
                  isToday
                    ? 'bg-brand text-on-brand'
                    : inMonth
                      ? 'text-text-body'
                      : 'text-text-placeholder'
                }`}
              >
                {format(day, 'd')}
              </span>
              <span
                className={`h-1 w-1 rounded-full ${count > 0 ? 'bg-brand' : 'bg-transparent'}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
