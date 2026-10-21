/**
 * Seasonal programmes (PRD §8.6): a named date range with a banner and
 * hours overrides (Ramadan: Pool 08:00–20:00), materialised into per-date
 * hours exceptions. Saving reports every recurring series whose classes
 * now fall outside those hours, with a suggested new time — flagged, not
 * moved (PRD: "flag it, and suggest moving the class time").
 */
import { id } from '@/lib/ids';
import { reject } from '@/domain/rules/errors';
import { programmeConflicts } from '../selectors/programme';
import { asState, materialiseSeason, seasonRange } from './programmeHelpers';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Season } from '@/types/event';
import type { SeasonHours } from '@/types/programme';

export interface SeasonCreateInput {
  name: string;
  startDate: string;
  endDate: string;
  banner: string;
  tone?: Season['tone'];
  hours?: SeasonHours[];
}

export interface SeasonClash {
  programmeId: string;
  title: string;
  occurrences: number;
  suggestedStart?: string;
}

declare module './types' {
  interface CommandRegistry {
    'season.create': {
      input: SeasonCreateInput;
      output: { season: Season; clashes: SeasonClash[] };
    };
  }
}

defineCommand<'season.create'>(
  {
    name: 'season.create',
    run: (ctx, input) => {
      if (!input.name.trim())
        return { ok: false, error: reject('NOT_ELIGIBLE', 'Name the season.') };
      if (input.endDate < input.startDate)
        return { ok: false, error: reject('NOT_ELIGIBLE', 'The season ends before it starts.') };
      const range = seasonRange(input.startDate, input.endDate);
      const season: Season = {
        id: id('season'),
        createdAt: ctx.now,
        updatedAt: ctx.now,
        name: input.name.trim(),
        start: range.start,
        end: range.end,
        banner: input.banner,
        tone: input.tone,
        hoursOverrides: [],
        hours: input.hours ?? [],
      };
      ctx.state.seasons[season.id] = season;
      materialiseSeason(ctx, season);
      const clashes = seasonClashes(ctx, season);
      return {
        ok: true,
        value: { season, clashes },
        events: [],
        jobs: [],
        audit: {
          action: 'season.create',
          target: { type: 'season', id: season.id },
          after: { name: season.name, hours: season.hours, clashes: clashes.length },
        },
      } satisfies CommandResult<{ season: Season; clashes: SeasonClash[] }>;
    },
  },
  {
    capability: 'amenity_status_hours.change',
    resolveAmenity: (input) => input.hours?.[0]?.amenity,
  },
);

/** Every active series on an amenity the season re-times whose occurrences fall outside the new hours. */
export function seasonClashes(ctx: Parameters<typeof asState>[0], season: Season): SeasonClash[] {
  const amenities = new Set((season.hours ?? []).map((h) => h.amenity));
  return Object.values(ctx.state.programme)
    .filter((p) => p.state === 'active' && amenities.has(p.amenity))
    .map((p) => {
      const hits = programmeConflicts(asState(ctx), p, ctx.now).hours.filter(
        (h) => h.occurrence.start >= season.start && h.occurrence.start <= season.end,
      );
      return {
        programmeId: p.id,
        title: p.title,
        occurrences: hits.length,
        suggestedStart: hits[0]?.suggestedStart,
      };
    })
    .filter((c) => c.occurrences > 0);
}
