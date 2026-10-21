/**
 * "Hours this week" (PRD §4.1 amenity detail: weekly hours + exceptions).
 */
import type { WeeklyHours, HoursException } from '@/types/amenity';
import { dubaiWeekday } from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';

export function HoursTable({
  hours,
  exceptions,
  now,
}: {
  hours: WeeklyHours[];
  exceptions: HoursException[];
  now: string;
}) {
  const t = useT();
  const fmt = useFmt();
  const today = dubaiWeekday(now);
  const byDay = new Map(hours.map((h) => [h.day, h]));

  return (
    <div className="flex flex-col gap-3">
      <div className="divide-border-card rounded-card border-border-card divide-y border-[0.5px]">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const label = fmt.weekday(day, 'EEE');
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
                {entry ? `${entry.open} – ${entry.close}` : t('status.closed')}
              </span>
            </div>
          );
        })}
      </div>

      {exceptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-label-3 text-text-muted">{t('ui.hours.exceptions')}</span>
          {exceptions.map((exc) => (
            <div key={exc.id} className="text-body-3 flex items-center justify-between">
              <span className="text-text-body">
                {fmt.date(exc.date)} — {exc.label}
              </span>
              <span className="text-text-muted">
                {exc.closed
                  ? t('status.closed')
                  : exc.open && exc.close
                    ? `${exc.open} – ${exc.close}`
                    : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
