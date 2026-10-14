/**
 * The demo clock engine (TRD §7.4, §16.4). `new Date()` must never be called
 * outside this file — everything else reads the demo clock.
 */
import { addDaysIso, addHoursIso, addMillisecondsIso, addMinutesIso, startOfDubaiDay } from '@/lib/time';
import type { Job, JobType } from './queue';
import { JobQueue } from './queue';

export type ClockSpeed = 1 | 2 | 5 | 10;

export interface JobRunResult {
  job: Job;
  /** New jobs created by this job's handler (already enqueued). */
  spawned: Job[];
}

export type JobHandler<P = unknown> = (job: Job<P>, ctx: { now: string }) => Job[] | void;

export interface RunDueSummary {
  ran: JobRunResult[];
  /** Count per job type, for the presenter ticker's batched summary. */
  byType: Partial<Record<JobType, number>>;
  /** True if the 5,000-job safety guard cut the run short. */
  truncated: boolean;
}

const MAX_JOBS_PER_RUN = 5000;

/**
 * Owns a `JobQueue` and a registry of per-`JobType` handlers. `runDue`
 * dispatches every job whose `runAt <= now`, in `(runAt, id)` order, giving
 * each handler the job's own `runAt` as its local `now` (TRD §7.4 step 2),
 * so timestamps stay true to the timeline even when the clock jumps days.
 * Handlers can enqueue follow-up jobs, which are picked up in the same run.
 */
export class SchedulerEngine {
  readonly queue = new JobQueue();
  private handlers = new Map<JobType, JobHandler>();

  on<P>(type: JobType, handler: JobHandler<P>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  runDue(now: string): RunDueSummary {
    const ran: JobRunResult[] = [];
    const byType: Partial<Record<JobType, number>> = {};
    let truncated = false;

    for (let i = 0; i < MAX_JOBS_PER_RUN; i += 1) {
      const next = this.queue.due(now)[0];
      if (!next) break;

      this.queue.markDone(next.id);
      const handler = this.handlers.get(next.type);
      const spawned: Job[] = [];

      if (handler) {
        const result = handler(next, { now: next.runAt });
        if (result) {
          for (const job of result) {
            if (this.queue.enqueue(job)) spawned.push(job);
          }
        }
      }

      ran.push({ job: next, spawned });
      byType[next.type] = (byType[next.type] ?? 0) + 1;

      if (i === MAX_JOBS_PER_RUN - 1) truncated = true;
    }

    return { ran, byType, truncated };
  }
}

// ---------------------------------------------------------------------------
// Pure clock-jump math (TRD §4.1 demo clock controls)
// ---------------------------------------------------------------------------

export type ClockJump = '+15m' | '+1h' | 'next_day';

export function applyJump(nowIso: string, jump: ClockJump): string {
  switch (jump) {
    case '+15m':
      return addMinutesIso(nowIso, 15);
    case '+1h':
      return addHoursIso(nowIso, 1);
    case 'next_day':
      return addDaysIso(startOfDubaiDay(nowIso), 1);
    default:
      return nowIso;
  }
}

/** Advance `nowIso` by real-time `elapsedMs` scaled by the clock speed (live mode). */
export function tickLive(nowIso: string, elapsedMs: number, speed: ClockSpeed): string {
  return addMillisecondsIso(nowIso, elapsedMs * speed);
}
