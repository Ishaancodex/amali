/**
 * The cleaning log (PRD §8.5): time-stamped entries per zone, with the
 * next one due.
 */
import { id } from '@/lib/ids';
import { addHoursIso } from '@/lib/time';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { CleaningLog } from '@/types/ops';

export interface CleaningLogInput {
  zone: string;
  nextDueHours: number;
}

declare module './types' {
  interface CommandRegistry {
    'cleaning.log': { input: CleaningLogInput; output: CleaningLog };
  }
}

defineCommand<'cleaning.log'>(
  {
    name: 'cleaning.log',
    run: (ctx, input) => {
      const logId = id('clog');
      const entry: CleaningLog = {
        id: logId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        zone: input.zone,
        at: ctx.now,
        by: ctx.actor.id,
        nextDue: addHoursIso(ctx.now, input.nextDueHours),
      };
      ctx.state.cleaningLogs[logId] = entry;

      return {
        ok: true,
        value: entry,
        events: [],
        jobs: [],
        audit: {
          action: 'cleaning.log',
          target: { type: 'cleaningLog', id: logId },
          after: { zone: input.zone },
        },
      } satisfies CommandResult<CleaningLog>;
    },
  },
  { capability: 'ops.checklists_logs' },
);
