/**
 * Runs every due job on `schedulerEngine`, then mirrors `done`/spawned jobs
 * back into the persisted `state.jobs` record (TRD §8.1) — kept separate
 * from `scheduler/clock.ts` so the engine itself stays store-agnostic and
 * testable without Zustand. `useDemoClock` calls this instead of
 * `schedulerEngine.runDue` directly.
 */
import { useStore } from '@/store';
import { schedulerEngine } from './engine';
import type { RunDueSummary } from './clock';

export function runDueAndSync(now: string): RunDueSummary {
  const summary = schedulerEngine.runDue(now);
  if (summary.ran.length === 0) return summary;

  useStore.setState((draft) => {
    for (const { job, spawned } of summary.ran) {
      const persisted = draft.jobs[job.id];
      if (persisted) persisted.done = true;
      for (const s of spawned) {
        draft.jobs[s.id] = s;
      }
    }
  });

  return summary;
}
