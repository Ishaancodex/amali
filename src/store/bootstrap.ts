/**
 * Hydrates the store from `buildSeed` (TRD §8.3 "Reset"). Called on first
 * load when the persisted store is empty (no community yet), and by the
 * presenter's Reset control (PRD §4.1) — built in Phase P1.
 */
import { buildSeed } from '@/seed';
import { schedulerEngine } from '@/scheduler/engine';
import { useStore } from './index';
import './commands/registerAll';
import '@/scheduler/registerJobs';

export function hydrateFromSeed(seed?: string, now?: string): void {
  const nextState = buildSeed(seed, now);
  // A shallow (non-replace) setState: every AppState key is provided and fully
  // overwrites its previous value, while the action methods (not present in
  // `nextState`, which is pure data) are left untouched.
  useStore.setState(nextState);
  // The live scheduler queue is separate from the persisted `jobs` record (see
  // store/commands/dispatch.ts) — a reset must clear both, or stale jobs from the old seed
  // (referencing bookings/waitlist entries that no longer exist) could still fire later.
  schedulerEngine.queue.clear();
  // The seed can schedule jobs too (e.g. seeded reservations' reminders) — they only fire once
  // they're in the live queue.
  for (const job of Object.values(nextState.jobs)) schedulerEngine.queue.enqueue({ ...job });
}

/** True if the store looks un-seeded (e.g. right after a version bump wiped persisted state). */
export function isStoreEmpty(): boolean {
  return Object.keys(useStore.getState().units).length === 0;
}

/**
 * After a reload the store comes back from localStorage, but the live
 * scheduler queue starts empty — re-enqueue every job not yet run, or
 * pending holds, reminders and no-show flags would silently never fire.
 */
export function restorePersistedJobs(): void {
  for (const job of Object.values(useStore.getState().jobs)) {
    if (!job.done) schedulerEngine.queue.enqueue({ ...job });
  }
}
