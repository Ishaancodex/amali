/**
 * The programme calendar's save step (PRD §8.6), shared by create and
 * edit: refuse on clashes with blackouts or other activities (or skip
 * those dates), require a handling choice for padel bookings in the way
 * and apply it, then materialise the series.
 */
import { fmtDateTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import { blockingConflicts } from '@/domain/programme/conflicts';
import { programmeConflicts, upcomingOccurrences } from '../selectors/programme';
import { applyBlackoutHandling } from './blackout';
import { asState, materialiseProgramme } from './programmeHelpers';
import type { CommandCtx, CommandError } from './types';
import type { BlackoutHandling } from '@/types/amenity';
import type { ProgrammeItem } from '@/types/programme';

export interface ProgrammeSaveOptions {
  /** How to treat padel bookings the series lands on (required when there are any). */
  handling?: BlackoutHandling;
  /** Skip the occurrences that clash with a blackout or another activity instead of refusing. */
  skipConflicts?: boolean;
}

/**
 * Checks and applies one series: refuses on clashes (or skips them), displaces padel bookings with
 * the chosen handling, then materialises. Returns an error, or what it did.
 */
export function save(ctx: CommandCtx, item: ProgrammeItem, opts: ProgrammeSaveOptions) {
  const conflicts = programmeConflicts(asState(ctx), item, ctx.now);
  if (blockingConflicts(conflicts) > 0) {
    const clashes = [...conflicts.blackouts, ...conflicts.activities];
    if (!opts.skipConflicts) {
      const first = clashes[0]!;
      const error: CommandError = reject(
        'VENUE_CONFLICT',
        `${clashes.length} ${clashes.length === 1 ? 'occurrence clashes' : 'occurrences clash'} — first ${fmtDateTime(first.occurrence.start)} with ${'reason' in first.with ? first.with.reason : first.with.title}. Change the time or skip those dates.`,
        { clashes: clashes.length },
      );
      return { error };
    }
    item.exdates = [
      ...new Set([...item.exdates, ...clashes.map((c) => c.occurrence.originalStart)]),
    ];
  }
  const displaced = conflicts.bookings.affectedBookings.length;
  if (displaced > 0 && !opts.handling) {
    return {
      error: reject(
        'NOT_ELIGIBLE',
        `${displaced} existing ${displaced === 1 ? 'booking is' : 'bookings are'} in the way — choose cancel & priority rebook, or auto-move.`,
        { bookings: displaced },
      ),
    };
  }

  ctx.state.programme[item.id] = item;
  const summary = materialiseProgramme(ctx, item);
  if (displaced > 0) {
    for (const o of upcomingOccurrences(item, ctx.now)) {
      applyBlackoutHandling(
        ctx,
        { start: o.start, end: o.end, reason: item.title },
        opts.handling!,
      );
    }
  }
  return {
    summary: {
      occurrences: summary.occurrences,
      displacedBookings: displaced,
      cancelledBookings: summary.cancelledBookings,
      hoursFlags: conflicts.hours.length,
      holidays: conflicts.holidays.filter((h) => !h.decision).length,
    },
  };
}
