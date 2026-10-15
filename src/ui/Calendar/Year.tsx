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

function MiniMonth({ monthStart, today }: { monthStart: Date; today: Date }) {
  const days = eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) });
  const leadingBlanks = getDay(startOfMonth(monthStart));

  return (
    <div className="rounded-card border-border-card border-[0.5px] p-2.5">
      <p className="text-label-3 text-text-title mb-1.5">{format(monthStart, 'MMMM')}</p>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map((day) => (
          <span
            key={day.toISOString()}
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] tabular-nums ${
              isSameDay(day, today) && isSameMonth(monthStart, today)
                ? 'bg-brand text-on-brand'
                : 'text-text-muted'
            }`}
          >
            {format(day, 'd')}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CalendarYear({ now }: { now: string }) {
  const today = toDubai(now);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));

  return (
    <div>
      <p className="text-label-1 text-text-title mb-3">{format(today, 'yyyy')}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {months.map((m) => (
          <MiniMonth key={m.toISOString()} monthStart={m} today={today} />
        ))}
      </div>
    </div>
  );
}
