'use client';

/** One month of every active series' occurrences, days shaded by season. Prev/next to move. */
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/ui/icons';
import { useStore } from '@/store';
import { bandOn } from '@/ui/Calendar/Year';
import {
  addDaysIso,
  addMonthsIso,
  dubaiDateKey,
  dubaiDateTimeToIso,
  dubaiWeekday,
} from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';
import { expandOccurrences } from '@/domain/programme/recurrence';
import { seasonBands } from '@/store/selectors/programme';
import { cn } from '@/lib/cn';
import type { AmenityKey } from '@/types/amenity';

const TONE: Partial<Record<AmenityKey, string>> = {
  pool: 'bg-info/15 text-info',
  padel: 'bg-brand-tint text-brand',
  music: 'bg-success/15 text-success',
  screening: 'bg-warning/15 text-warning',
};
const BAND: Record<string, string> = {
  brand: 'bg-brand-tint',
  info: 'bg-info/5',
  success: 'bg-success/5',
  warning: 'bg-warning/10',
};
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function ProgrammeMonth({
  onOpen,
}: {
  onOpen: (programmeId: string, originalStart: string) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const programme = useStore((s) => s.programme);
  const seasons = useStore((s) => s.seasons);
  const now = useStore((s) => s.demo.clock.now);
  const [offset, setOffset] = useState(0);

  const anchor = addMonthsIso(now, offset);
  const monthKey = dubaiDateKey(anchor).slice(0, 7);
  const first = dubaiDateTimeToIso(`${monthKey}-01`, '00:00');
  const next = dubaiDateTimeToIso(
    `${dubaiDateKey(addMonthsIso(first, 1)).slice(0, 7)}-01`,
    '00:00',
  );
  const gridStart = addDaysIso(first, -dubaiWeekday(first));
  const days = Array.from({ length: 42 }, (_, i) => addDaysIso(gridStart, i)).filter(
    (d, i) => i < 35 || dubaiDateKey(d).slice(0, 7) === monthKey,
  );

  const occurrences = Object.values(programme)
    .filter((p) => p.state === 'active')
    .flatMap((p) =>
      expandOccurrences(p, gridStart, addDaysIso(gridStart, days.length)).map((o) => ({
        ...o,
        item: p,
      })),
    );
  const bands = seasonBands(seasons);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t('console.month.prev')}
          onClick={() => setOffset(offset - 1)}
          className="text-brand p-1"
        >
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.5} />
        </button>
        <p className="text-label-1 text-text-title w-36 text-center">
          {fmt.date(first, 'MMMM yyyy')}
        </p>
        <button
          type="button"
          aria-label={t('console.month.next')}
          onClick={() => setOffset(offset + 1)}
          className="text-brand p-1"
        >
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.5} />
        </button>
        {bands
          .filter((b) => b.to >= dubaiDateKey(first) && b.from < dubaiDateKey(next))
          .map((b) => (
            <span
              key={b.name}
              className={cn('rounded-tag text-label-3 text-text-body px-2 py-0.5', BAND[b.tone])}
            >
              {b.name}
            </span>
          ))}
      </div>
      <div className="border-border-card rounded-card grid grid-cols-7 overflow-hidden border-[0.5px]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-label-3 text-text-muted border-border-card border-b-[0.5px] px-2 py-1.5"
          >
            {fmt.weekday(d, 'EEE')}
          </div>
        ))}
        {days.map((day) => {
          const key = dubaiDateKey(day);
          const inMonth = key.slice(0, 7) === monthKey;
          const band = bandOn(bands, key);
          const today = key === dubaiDateKey(now);
          const mine = occurrences
            .filter((o) => dubaiDateKey(o.start) === key)
            .sort((a, b) => a.start.localeCompare(b.start));
          return (
            <div
              key={key}
              className={cn(
                'border-border-card flex min-h-24 flex-col gap-1 border-e-[0.5px] border-b-[0.5px] p-1.5',
                band && BAND[band.tone],
                !inMonth && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'text-label-3 self-start rounded-full px-1.5',
                  today ? 'bg-brand text-on-brand' : 'text-text-muted',
                )}
              >
                {fmt.date(day, 'd')}
              </span>
              {mine.map((o) => (
                <button
                  key={`${o.item.id}:${o.originalStart}`}
                  type="button"
                  onClick={() => onOpen(o.item.id, o.originalStart)}
                  className={cn(
                    'text-body-3 truncate rounded-sm px-1 py-0.5 text-start',
                    TONE[o.item.amenity] ?? 'bg-brand-tint text-brand',
                    o.overridden && 'italic',
                  )}
                >
                  {fmt.time(o.start)} {o.item.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
