/**
 * Editing a series (PRD §8.6: "This occurrence / This and following /
 * All"). Pure: each returns the item(s) as they should be saved.
 *
 * - **This occurrence** moves or deletes one occurrence (an override, or
 *   an exdate), leaving the rule alone.
 * - **This and following** splits the series: the original ends the day
 *   before, and a new series carries the change from this occurrence on —
 *   keeping a COUNT honest by giving the tail only what's left.
 * - **All** changes the series itself; moved one-offs are dropped when the
 *   time or rule changes (they were relative to the old times).
 */
import { RRule } from 'rrule';
import { addMinutesIso, dubaiDateKey, dubaiDateTimeToIso, fmtTime } from '@/lib/time';
import type { ProgrammeItem } from '@/types/programme';
import { expandOccurrences } from './recurrence';

export type EditScope = 'this' | 'following' | 'all';

export interface SeriesPatch {
  /** New start time of day, HH:mm (Dubai). */
  startTime?: string;
  durationMins?: number;
  title?: string;
  note?: string;
  rrule?: string;
}

function withTime(iso: string, hhmm: string): string {
  return dubaiDateTimeToIso(dubaiDateKey(iso), hhmm);
}

export function editThisOccurrence(
  item: ProgrammeItem,
  originalStart: string,
  change: { delete: true } | { startTime?: string; durationMins?: number },
): ProgrammeItem {
  if ('delete' in change) {
    const overrides = { ...item.overrides };
    delete overrides[originalStart];
    return { ...item, exdates: [...new Set([...item.exdates, originalStart])], overrides };
  }
  const current = item.overrides[originalStart];
  const start = change.startTime
    ? withTime(originalStart, change.startTime)
    : (current?.start ?? originalStart);
  const durationMins = change.durationMins ?? item.durationMins;
  return {
    ...item,
    overrides: {
      ...item.overrides,
      [originalStart]: { start, end: addMinutesIso(start, durationMins) },
    },
  };
}

/** The rule truncated to end just before `beforeIso` (Dubai wall-clock), replacing any COUNT. */
function truncateBefore(rrule: string, beforeIso: string): string {
  const opts = RRule.parseString(rrule);
  const key = dubaiDateKey(beforeIso);
  // UNTIL is compared in floating (wall-clock) time; the day before at 23:59 ends the series cleanly.
  const until = new Date(`${key}T00:00:00Z`);
  until.setUTCMinutes(-1);
  opts.until = until;
  delete opts.count;
  return RRule.optionsToString(opts).replace(/^RRULE:/, '');
}

function withCount(rrule: string, count: number | undefined): string {
  const opts = RRule.parseString(rrule);
  if (count === undefined) delete opts.count;
  else opts.count = count;
  return RRule.optionsToString(opts).replace(/^RRULE:/, '');
}

export function editThisAndFollowing(
  item: ProgrammeItem,
  originalStart: string,
  patch: SeriesPatch | { delete: true },
  newId: string,
  now: string,
): { head: ProgrammeItem; tail?: ProgrammeItem } {
  const headExdates = item.exdates.filter((d) => d < originalStart);
  const headOverrides = Object.fromEntries(
    Object.entries(item.overrides).filter(([k]) => k < originalStart),
  );
  const head: ProgrammeItem = {
    ...item,
    rrule: truncateBefore(item.rrule, originalStart),
    exdates: headExdates,
    overrides: headOverrides,
    updatedAt: now,
  };
  if ('delete' in patch) return { head };

  // A COUNT carries over as what's left after the head's occurrences.
  const count = RRule.parseString(item.rrule).count ?? undefined;
  const used = count
    ? expandOccurrences({ ...item, exdates: [], overrides: {} }, item.dtstart, originalStart).length
    : 0;
  const tailRule = withCount(
    patch.rrule ?? item.rrule,
    count ? Math.max(1, count - used) : undefined,
  );
  const dtstart = patch.startTime ? withTime(originalStart, patch.startTime) : originalStart;
  const timeChanged = dtstart !== originalStart || !!patch.rrule;
  const tail: ProgrammeItem = {
    ...item,
    id: newId,
    createdAt: now,
    updatedAt: now,
    title: patch.title ?? item.title,
    note: patch.note ?? item.note,
    durationMins: patch.durationMins ?? item.durationMins,
    rrule: tailRule,
    dtstart,
    exdates: timeChanged ? [] : item.exdates.filter((d) => d >= originalStart),
    overrides: timeChanged
      ? {}
      : Object.fromEntries(Object.entries(item.overrides).filter(([k]) => k >= originalStart)),
    holidayDecisions: { ...item.holidayDecisions },
  };
  return { head, tail };
}

export function editAll(item: ProgrammeItem, patch: SeriesPatch, now: string): ProgrammeItem {
  const dtstart = patch.startTime ? withTime(item.dtstart, patch.startTime) : item.dtstart;
  const timeChanged = dtstart !== item.dtstart || (!!patch.rrule && patch.rrule !== item.rrule);
  return {
    ...item,
    title: patch.title ?? item.title,
    note: patch.note ?? item.note,
    durationMins: patch.durationMins ?? item.durationMins,
    rrule: patch.rrule ?? item.rrule,
    dtstart,
    overrides: timeChanged ? {} : item.overrides,
    // An exdate is an original start under the old times — shift it with the series.
    exdates:
      dtstart === item.dtstart
        ? item.exdates
        : item.exdates.map((d) => withTime(d, fmtTime(dtstart))),
    updatedAt: now,
  };
}
