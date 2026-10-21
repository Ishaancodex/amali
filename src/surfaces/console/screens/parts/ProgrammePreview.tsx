'use client';

/**
 * The editor's live preview (PRD §8.6): the rule in words, the next
 * occurrences, and every conflict the save will check — clashes that
 * block, padel bookings it displaces (the blackout's impact preview and
 * options), classes outside opening hours, and public holidays.
 */
import { Banner } from '@/ui/Banner';
import { Card } from '@/ui/Card';
import { fmtAed } from '@/lib/money';
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/time';
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
  const clashes = [...conflicts.blackouts, ...conflicts.activities];
  const impact = conflicts.bookings;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-label-1 text-text-title">{description}</p>
        <p className="text-body-3 text-text-muted">
          {occurrences.length} occurrences in the next 12 months
        </p>
      </div>
      <ul className="text-body-3 text-text-body flex flex-col gap-0.5">
        {occurrences.slice(0, SHOWN).map((o) => (
          <li key={o.originalStart}>
            {fmtDateTime(o.start)}–{fmtTime(o.end)}
          </li>
        ))}
        {occurrences.length > SHOWN && (
          <li className="text-text-muted">…and {occurrences.length - SHOWN} more</li>
        )}
      </ul>

      {clashes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Banner style="urgent">
            {clashes.length} {clashes.length === 1 ? 'date clashes' : 'dates clash'} — first{' '}
            {fmtDateTime(clashes[0]!.occurrence.start)} with{' '}
            {'reason' in clashes[0]!.with ? clashes[0]!.with.reason : clashes[0]!.with.title}.
          </Banner>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand h-4 w-4"
              checked={skip}
              onChange={(e) => onSkip(e.target.checked)}
            />
            <span className="text-body-2 text-text-body">Skip the clashing dates</span>
          </label>
        </div>
      )}

      {impact.affectedBookings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Banner style="warning">
            {impact.affectedBookings.length} bookings · {impact.affectedResidentCount} residents ·{' '}
            {impact.affectedWaitlistEntries.length} waitlist entries
            {impact.guestFeesToRefundFils
              ? ` · ${fmtAed(impact.guestFeesToRefundFils)} guest fees to refund`
              : ''}
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
                {h === 'cancel_priority_rebook'
                  ? 'Cancel & priority rebook'
                  : 'Auto-move to nearest slot'}
              </button>
            ))}
          </div>
        </div>
      )}

      {conflicts.hours.length > 0 && (
        <Banner style="warning">
          {conflicts.hours.length} {conflicts.hours.length === 1 ? 'class falls' : 'classes fall'}{' '}
          outside opening hours (from {fmtDate(conflicts.hours[0]!.occurrence.start)}, open{' '}
          {conflicts.hours[0]!.open}–{conflicts.hours[0]!.close})
          {conflicts.hours[0]!.suggestedStart
            ? ` — try ${fmtTime(conflicts.hours[0]!.suggestedStart)}`
            : ''}
          .
        </Banner>
      )}
      {conflicts.holidays.length > 0 && (
        <Banner style="info">
          Falls on{' '}
          {conflicts.holidays.map((h) => `${h.name} (${fmtDate(h.occurrence.start)})`).join(', ')} —
          choose Skip or Keep from the series list after saving.
        </Banner>
      )}
    </Card>
  );
}
