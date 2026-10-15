/**
 * "Hours this week" (PRD §4.1 amenity detail: weekly hours + exceptions).
 */
import type { WeeklyHours, HoursException } from '@/types/amenity';
import { dubaiWeekday, fmtDate } from '@/lib/time';

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HoursTable({
  hours,
  exceptions,
  now,
}: {
  hours: WeeklyHours[];
  exceptions: HoursException[];
  now: string;
}) {
  const today = dubaiWeekday(now);
  const byDay = new Map(hours.map((h) => [h.day, h]));

  return (
    <div className="flex flex-col gap-3">
      <div className="divide-border-card rounded-card border-border-card divide-y border-[0.5px]">
        {DAY_LABEL.map((label, day) => {
          const entry = byDay.get(day as WeeklyHours['day']);
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`flex items-center justify-between px-4 py-2.5 ${isToday ? 'bg-brand-tint' : ''}`}
            >
              <span className={`text-body-2 ${isToday ? 'text-brand' : 'text-text-body'}`}>
                {label}
              </span>
              <span
                className={`text-body-2 tabular-nums ${isToday ? 'text-brand' : 'text-text-muted'}`}
              >
                {entry ? `${entry.open} – ${entry.close}` : 'Closed'}
              </span>
            </div>
          );
        })}
      </div>

      {exceptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-label-3 text-text-muted">Exceptions</span>
          {exceptions.map((exc) => (
            <div key={exc.id} className="text-body-3 flex items-center justify-between">
              <span className="text-text-body">
                {fmtDate(exc.date)} — {exc.label}
              </span>
              <span className="text-text-muted">
                {exc.closed ? 'Closed' : exc.open && exc.close ? `${exc.open} – ${exc.close}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
