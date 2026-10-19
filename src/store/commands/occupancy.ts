/**
 * The guard's live occupancy counter (PRD §8.9: "+/- buttons... the value
 * can't go below 0"). The UI debounces taps itself (1s); this command is
 * the single atomic adjustment either side of that debounce calls.
 */
import { adjustOccupancy } from '@/domain/ops/occupancy';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { AmenityKey } from '@/types/amenity';

export interface OccupancyAdjustInput {
  amenity: AmenityKey;
  delta: number;
}

declare module './types' {
  interface CommandRegistry {
    'occupancy.adjust': { input: OccupancyAdjustInput; output: number };
  }
}

defineCommand<'occupancy.adjust'>({
  name: 'occupancy.adjust',
  run: (ctx, input) => {
    const current = ctx.state.occupancy[input.amenity] ?? 0;
    const next = adjustOccupancy(current, input.delta);
    ctx.state.occupancy[input.amenity] = next;

    return {
      ok: true,
      value: next,
      events: [],
      jobs: [],
    } satisfies CommandResult<number>;
  },
});
