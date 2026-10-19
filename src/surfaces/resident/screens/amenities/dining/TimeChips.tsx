'use client';

/** Start-time chips (PRD §8.4 step 2): "Limited" when less than 25% of the venue is left; full or past times are disabled. */
import { useStore } from '@/store';
import { rules } from '@/config/rules';
import { addMinutesIso, fmtTime } from '@/lib/time';
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
  const tables = useStore((s) => s.tables);
  const reservations = useStore((s) => s.reservations);
  const now = useStore((s) => s.demo.clock.now);
  const times = startTimes(venue, window, partySize, rules.dining);
  const minutes = tableMinutes(venue, partySize, rules.dining);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label-1 text-text-title">Time</h2>
      {times.length === 0 ? (
        <p className="text-body-3 text-text-muted">No seatings in this period for that party.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {times.map((t) => {
            const free = freeFraction(
              Object.values(tables),
              Object.values(reservations),
              venue,
              t,
              addMinutesIso(t, minutes),
            );
            const limited = free > 0 && free < rules.dining.restaurant.limitedBelowFraction;
            return (
              <Chip
                key={t}
                active={value === t}
                disabled={t <= now || free === 0}
                onClick={() => onChange(t)}
              >
                {fmtTime(t)}
                {limited ? ' · Limited' : ''}
              </Chip>
            );
          })}
        </div>
      )}
    </section>
  );
}
