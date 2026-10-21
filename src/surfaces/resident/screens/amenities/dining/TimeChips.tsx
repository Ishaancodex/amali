'use client';

/** Start-time chips (PRD §8.4 step 2): "Limited" when less than 25% of the venue is left; full or past times are disabled. */
import { useStore } from '@/store';
import { rules } from '@/config/rules';
import { addMinutesIso } from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';
import { startTimes, tableMinutes, type PeriodWindow } from '@/domain/dining/periods';
import { freeFraction } from '@/domain/dining/tables';
import type { VenueKey } from '@/types/dining';
import { Chip } from './Chip';

export function TimeChips({
  venue,
  window,
  partySize,
  value,
  onChange,
}: {
  venue: VenueKey;
  window: PeriodWindow;
  partySize: number;
  value: string | undefined;
  onChange: (start: string) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const tables = useStore((s) => s.tables);
  const reservations = useStore((s) => s.reservations);
  const now = useStore((s) => s.demo.clock.now);
  const times = startTimes(venue, window, partySize, rules.dining);
  const minutes = tableMinutes(venue, partySize, rules.dining);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label-1 text-text-title">{t('padel.time')}</h2>
      {times.length === 0 ? (
        <p className="text-body-3 text-text-muted">{t('dining.noSeatings')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {times.map((time) => {
            const free = freeFraction(
              Object.values(tables),
              Object.values(reservations),
              venue,
              time,
              addMinutesIso(time, minutes),
            );
            const limited = free > 0 && free < rules.dining.restaurant.limitedBelowFraction;
            return (
              <Chip
                key={time}
                active={value === time}
                disabled={time <= now || free === 0}
                onClick={() => onChange(time)}
              >
                {fmt.time(time)}
                {limited ? ` · ${t('status.limited')}` : ''}
              </Chip>
            );
          })}
        </div>
      )}
    </section>
  );
}
