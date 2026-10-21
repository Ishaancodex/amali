'use client';

/**
 * The editor's live preview (PRD §8.6): the rule in words, the next
 * occurrences, and every conflict the save will check — clashes that
 * block, padel bookings it displaces (the blackout's impact preview and
 * options), classes outside opening hours, and public holidays.
 */
import { Banner } from '@/ui/Banner';
import { Card } from '@/ui/Card';
import { useFmt, useT } from '@/i18n/hooks';
import { cn } from '@/lib/cn';
import type { ProgrammeConflicts } from '@/domain/programme/conflicts';
import type { Occurrence } from '@/domain/programme/recurrence';
import type { BlackoutHandling } from '@/types/amenity';

const SHOWN = 6;

export function ProgrammePreview({
  description,
  occurrences,
  conflicts,
  handling,
  onHandling,
  skip,
  onSkip,
}: {
  description: string;
  occurrences: Occurrence[];
  conflicts: ProgrammeConflicts;
  handling: BlackoutHandling;
  onHandling: (h: BlackoutHandling) => void;
  skip: boolean;
  onSkip: (v: boolean) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const clashes = [...conflicts.blackouts, ...conflicts.activities];
  const impact = conflicts.bookings;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-label-1 text-text-title">{description}</p>
        <p className="text-body-3 text-text-muted">
          {t('console.preview.occurrences', { count: occurrences.length })}
        </p>
      </div>
      <ul className="text-body-3 text-text-body flex flex-col gap-0.5">
        {occurrences.slice(0, SHOWN).map((o) => (
          <li key={o.originalStart}>
            {fmt.dateTime(o.start)}–{fmt.time(o.end)}
          </li>
        ))}
        {occurrences.length > SHOWN && (
          <li className="text-text-muted">
            {t('console.preview.more', { count: occurrences.length - SHOWN })}
          </li>
        )}
      </ul>

      {clashes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Banner style="urgent">
            {t('console.preview.clashes', {
              count: clashes.length,
              date: fmt.dateTime(clashes[0]!.occurrence.start),
              what: 'reason' in clashes[0]!.with ? clashes[0]!.with.reason : clashes[0]!.with.title,
            })}
          </Banner>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand h-4 w-4"
              checked={skip}
              onChange={(e) => onSkip(e.target.checked)}
            />
            <span className="text-body-2 text-text-body">{t('console.preview.skip')}</span>
          </label>
        </div>
      )}

      {impact.affectedBookings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Banner style="warning">
            {t('console.blackout.impactLine', {
              bookings: impact.affectedBookings.length,
              residents: impact.affectedResidentCount,
              waitlist: impact.affectedWaitlistEntries.length,
              refund: fmt.aed(impact.guestFeesToRefundFils),
            })}
          </Banner>
          <div className="flex gap-2">
            {(['cancel_priority_rebook', 'auto_move'] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onHandling(h)}
                className={cn(
                  'rounded-tag text-label-3 px-3 py-1.5',
                  handling === h ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                )}
              >
                {t(`console.blackout.handling.${h}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {conflicts.hours.length > 0 && (
        <Banner style="warning">
          {t('console.preview.outsideHours', {
            count: conflicts.hours.length,
            date: fmt.date(conflicts.hours[0]!.occurrence.start),
            open: conflicts.hours[0]!.open,
            close: conflicts.hours[0]!.close,
          })}
          {conflicts.hours[0]!.suggestedStart
            ? ` ${t('console.preview.tryAt', { time: fmt.time(conflicts.hours[0]!.suggestedStart) })}`
            : ''}
        </Banner>
      )}
      {conflicts.holidays.length > 0 && (
        <Banner style="info">
          {t('console.preview.holidays', {
            list: conflicts.holidays
              .map((h) => `${h.name} (${fmt.date(h.occurrence.start)})`)
              .join(', '),
          })}
        </Banner>
      )}
    </Card>
  );
}
