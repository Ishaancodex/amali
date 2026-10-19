/**
 * Daily operations checklist submission (PRD §8.5). A failed item prompts
 * "Raise incident" in the UI — a separate follow-up `incident.raise` call,
 * not bundled here, since the resident/staff member decides per item.
 */
import { id } from '@/lib/ids';
import { dubaiDateKey } from '@/lib/time';
import { isChecklistLate } from '@/domain/ops/checklist';
import { defineCommand } from './registry';
import type { CommandResult } from './types';
import type { ChecklistRun, ChecklistRunItem } from '@/types/ops';

export interface ChecklistSubmitInput {
  templateId: string;
  items: {
    itemId: string;
    result: 'pass' | 'fail';
    note?: string;
    photo?: string;
    incidentId?: string;
  }[];
}

declare module './types' {
  interface CommandRegistry {
    'checklist.submit': { input: ChecklistSubmitInput; output: ChecklistRun & { late: boolean } };
  }
}

defineCommand<'checklist.submit'>(
  {
    name: 'checklist.submit',
    run: (ctx, input) => {
      const template = ctx.state.checklistTemplates[input.templateId];
      if (!template) {
        return {
          ok: false,
          error: { code: 'NOT_ELIGIBLE', message: 'Checklist template not found.' },
        };
      }

      const runId = id('checklist');
      const dateKey = dubaiDateKey(ctx.now);
      const run: ChecklistRun = {
        id: runId,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        templateId: input.templateId,
        date: dateKey,
        by: ctx.actor.id,
        completedAt: ctx.now,
        items: input.items as ChecklistRunItem[],
      };
      ctx.state.checklistRuns[runId] = run;

      const late = isChecklistLate(dateKey, template.dueTime, ctx.now);
      const failedCount = input.items.filter((i) => i.result === 'fail').length;

      return {
        ok: true,
        value: { ...run, late },
        events: [],
        jobs: [],
        audit: {
          action: 'checklist.submit',
          target: { type: 'checklistRun', id: runId },
          after: { templateId: input.templateId, late, failedCount },
        },
      } satisfies CommandResult<ChecklistRun & { late: boolean }>;
    },
  },
  { capability: 'ops.checklists_logs' },
);
