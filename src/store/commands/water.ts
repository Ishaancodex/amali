/**
 * Water-quality logging (PRD §8.5): an out-of-range reading offers to set
 * the pool to Limited/Closed and raise an incident in the same step — the
 * composer passes both flags once the resident has confirmed the prompt,
 * so this command does all three writes atomically rather than chaining
 * separate dispatches.
 */
import { id } from '@/lib/ids';
import { rules } from '@/config/rules';
import { outOfRangeParams } from '@/domain/ops/water';
import { findDuplicateIncident } from '@/domain/ops/incidents';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { Incident, WaterReading } from '@/types/ops';
import type { AmenityStatus, StatusEntry } from '@/types/amenity';

export interface WaterLogInput {
  ph: number;
  freeChlorine: number;
  tempC: number;
  clarity: 'pass' | 'fail';
  setStatusIfOutOfRange?: Extract<AmenityStatus, 'limited' | 'closed'>;
  raiseIncidentIfOutOfRange?: boolean;
}

export interface WaterLogOutput {
  reading: WaterReading;
  statusEntry?: StatusEntry;
  incident?: Incident;
}

declare module './types' {
  interface CommandRegistry {
    'water.log': { input: WaterLogInput; output: WaterLogOutput };
  }
}

defineCommand<'water.log'>(
  {
    name: 'water.log',
    run: (ctx, input) => {
      const outOfRange = outOfRangeParams(input, rules.pool.waterQuality);

      const readingId = id('water');
      const reading: WaterReading = {
        id: readingId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        at: ctx.now,
        by: ctx.actor.id,
        ph: input.ph,
        freeChlorine: input.freeChlorine,
        tempC: input.tempC,
        clarity: input.clarity,
        outOfRange,
      };
      ctx.state.waterReadings[readingId] = reading;

      const output: WaterLogOutput = { reading };

      if (outOfRange.length > 0 && input.setStatusIfOutOfRange) {
        const statusId = id('status');
        const statusEntry: StatusEntry = {
          id: statusId,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          amenity: 'pool',
          status: input.setStatusIfOutOfRange,
          reason: 'Water balancing in progress',
          from: ctx.now,
          setBy: ctx.actor.id,
        };
        ctx.state.amenityStatus.push(statusEntry);
        output.statusEntry = statusEntry;
      }

      if (outOfRange.length > 0 && input.raiseIncidentIfOutOfRange) {
        const duplicate = findDuplicateIncident(
          Object.values(ctx.state.incidents),
          'pool',
          'water_quality',
          ctx.now,
        );
        if (!duplicate) {
          const incidentId = id('inc');
          const incident: Incident = {
            id: incidentId,
            createdAt: ctx.now,
            updatedAt: ctx.now,
            amenity: 'pool',
            category: 'water_quality',
            severity: 'medium',
            description: `Water reading out of range: ${outOfRange.join(', ')}.`,
            raisedBy: ctx.actor.id,
            raisedVia: 'checklist',
            at: ctx.now,
          };
          ctx.state.incidents[incidentId] = incident;
          output.incident = incident;
        }
      }

      return {
        ok: true,
        value: output,
        events: [],
        jobs: [],
        audit: {
          action: 'water.log',
          target: { type: 'waterReading', id: readingId },
          after: {
            outOfRange,
            statusChanged: !!output.statusEntry,
            incidentRaised: !!output.incident,
          },
        },
      } satisfies CommandResult<WaterLogOutput>;
    },
  },
  { capability: 'ops.checklists_logs', resolveAmenity: () => 'pool' },
);
