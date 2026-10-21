/**
 * Programme calendar commands (PRD §8.6). Saving a series checks its
 * occurrences for conflicts: a clash with a blackout or another activity
 * in the venue blocks the save unless those dates are skipped; existing
 * padel bookings are displaced with the same options as a blackout
 * (cancel + priority rebook, or auto-move); hours and public holidays are
 * flagged, not blocked. Edits take a scope — this occurrence, this and
 * following, or all.
 */
import { id } from '@/lib/ids';
import { dubaiDateKey, fmtDateTime } from '@/lib/time';
import { reject } from '@/domain/rules/errors';
import {
  editAll,
  editThisAndFollowing,
  editThisOccurrence,
  type EditScope,
  type SeriesPatch,
} from '@/domain/programme/editScope';
import { upcomingOccurrences } from '../selectors/programme';
import { materialiseProgramme } from './programmeHelpers';
import { save, type ProgrammeSaveOptions } from './programmeSave';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { ProgrammeItem } from '@/types/programme';

export interface ProgrammeCreateInput extends ProgrammeSaveOptions {
  title: string;
  amenity: ProgrammeItem['amenity'];
  effect: ProgrammeItem['effect'];
  note?: string;
  rrule: string;
  dtstart: string;
  durationMins: number;
  capacity?: number;
  seasonId?: string;
}

export interface ProgrammeEditInput extends ProgrammeSaveOptions {
  programmeId: string;
  /** The occurrence the edit was started from (its original start). */
  originalStart: string;
  scope: EditScope;
  change: (SeriesPatch & { delete?: false }) | { delete: true };
}

export interface ProgrammeHolidayInput {
  programmeId: string;
  date: string;
  decision: 'skip' | 'keep';
}

export interface ProgrammeSaveResult {
  items: ProgrammeItem[];
  occurrences: number;
  displacedBookings: number;
  cancelledBookings: number;
  hoursFlags: number;
  holidays: number;
}

declare module './types' {
  interface CommandRegistry {
    'programme.create': { input: ProgrammeCreateInput; output: ProgrammeSaveResult };
    'programme.edit': { input: ProgrammeEditInput; output: ProgrammeSaveResult };
    'programme.decideHoliday': { input: ProgrammeHolidayInput; output: ProgrammeItem };
  }
}

defineCommand<'programme.create'>(
  {
    name: 'programme.create',
    run: (ctx, input) => {
      if (!input.title.trim())
        return { ok: false, error: reject('NOT_ELIGIBLE', 'Give the activity a name.') };
      if (input.effect === 'event' && input.amenity !== 'music' && input.amenity !== 'screening') {
        return {
          ok: false,
          error: reject('NOT_ELIGIBLE', 'Bookable classes run in the Music or Screening Room.'),
        };
      }
      if (input.effect === 'blackout' && input.amenity !== 'padel') {
        return {
          ok: false,
          error: reject('NOT_ELIGIBLE', 'Only the padel court takes a recurring blackout.'),
        };
      }
      const item: ProgrammeItem = {
        id: id('prog'),
        createdAt: ctx.now,
        updatedAt: ctx.now,
        title: input.title.trim(),
        amenity: input.amenity,
        effect: input.effect,
        note: input.note?.trim() || undefined,
        rrule: input.rrule,
        dtstart: input.dtstart,
        durationMins: input.durationMins,
        exdates: [],
        overrides: {},
        holidayDecisions: {},
        capacity: input.capacity,
        seasonId: input.seasonId,
        state: 'active',
      };
      if (upcomingOccurrences(item, ctx.now).length === 0) {
        return {
          ok: false,
          error: reject('NOT_ELIGIBLE', 'That rule has no occurrences from now on.'),
        };
      }
      const saved = save(ctx, item, input);
      if ('error' in saved) return { ok: false, error: saved.error! };
      return {
        ok: true,
        value: { items: [ctx.state.programme[item.id]!], ...saved.summary },
        events: [],
        jobs: [],
        audit: {
          action: 'programme.create',
          target: { type: 'programme', id: item.id },
          after: { title: item.title, rrule: item.rrule, ...saved.summary },
        },
      } satisfies CommandResult<ProgrammeSaveResult>;
    },
  },
  { capability: 'event.manage', resolveAmenity: (input) => input.amenity },
);

defineCommand<'programme.edit'>(
  {
    name: 'programme.edit',
    run: (ctx, input) => {
      const current = ctx.state.programme[input.programmeId];
      if (!current) return { ok: false, error: reject('NOT_ELIGIBLE', 'Series not found.') };
      const item = JSON.parse(JSON.stringify(current)) as ProgrammeItem;
      const change = input.change;

      let next: ProgrammeItem[];
      if (input.scope === 'this') {
        next = [
          editThisOccurrence(item, input.originalStart, change.delete ? { delete: true } : change),
        ];
      } else if (input.scope === 'following') {
        const { head, tail } = editThisAndFollowing(
          item,
          input.originalStart,
          change.delete ? { delete: true } : change,
          id('prog'),
          ctx.now,
        );
        next = tail ? [head, tail] : [head];
      } else if (change.delete) {
        next = [{ ...item, state: 'ended', updatedAt: ctx.now }];
      } else {
        next = [editAll(item, change, ctx.now)];
      }

      const totals = {
        occurrences: 0,
        displacedBookings: 0,
        cancelledBookings: 0,
        hoursFlags: 0,
        holidays: 0,
      };
      for (const n of next) {
        const saved = save(ctx, n, input);
        if ('error' in saved) return { ok: false, error: saved.error! };
        for (const k of Object.keys(totals) as (keyof typeof totals)[])
          totals[k] += saved.summary[k];
      }
      return {
        ok: true,
        value: { items: next.map((n) => ctx.state.programme[n.id]!), ...totals },
        events: [],
        jobs: [],
        audit: {
          action: 'programme.edit',
          target: { type: 'programme', id: current.id },
          after: {
            scope: input.scope,
            originalStart: input.originalStart,
            change: input.change,
            ...totals,
          },
        },
      } satisfies CommandResult<ProgrammeSaveResult>;
    },
  },
  { capability: 'event.manage', resolveAmenity: () => undefined },
);

defineCommand<'programme.decideHoliday'>(
  {
    name: 'programme.decideHoliday',
    run: (ctx, input) => {
      const item = ctx.state.programme[input.programmeId];
      if (!item) return { ok: false, error: reject('NOT_ELIGIBLE', 'Series not found.') };
      const onDate = upcomingOccurrences({ ...item, exdates: [] }, ctx.now).find(
        (o) => dubaiDateKey(o.originalStart) === input.date,
      );
      item.holidayDecisions[input.date] = input.decision;
      if (onDate) {
        item.exdates =
          input.decision === 'skip'
            ? [...new Set([...item.exdates, onDate.originalStart])]
            : item.exdates.filter((d) => d !== onDate.originalStart);
      }
      item.updatedAt = ctx.now;
      materialiseProgramme(ctx, item);
      return {
        ok: true,
        value: item,
        events: [],
        jobs: [],
        audit: {
          action: 'programme.decideHoliday',
          target: { type: 'programme', id: item.id },
          after: { date: input.date, decision: input.decision },
        },
      } satisfies CommandResult<ProgrammeItem>;
    },
  },
  { capability: 'event.manage', resolveAmenity: () => undefined },
);
