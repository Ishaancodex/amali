/**
 * The job queue (TRD §7.4). Jobs are keyed by a deterministic `id` —
 * enqueuing an id that already exists is a no-op, which is what makes jobs
 * idempotent under a clock jump that might otherwise double-schedule them.
 */

export type JobType =
  | 'hold.expire'
  | 'waitlist.offerExpire'
  | 'booking.reminder'
  | 'booking.noShowSweep'
  // P4 — distinct from the padel 'hold.expire'/'waitlist.offerExpire' above: `schedulerEngine.on`
  // registers one handler per JobType, so a same-shaped-but-different-domain job needs its own type.
  | 'rsvp.holdExpire'
  | 'eventWaitlist.offerExpire'
  | 'event.reminder'
  | 'event.regClose'
  | 'showtime.complete'
  | 'dining.reminder'
  | 'dining.noShowFlag'
  | 'creche.pickupReminder'
  | 'creche.latePickup'
  | 'creche.endOfDaySweep'
  | 'announcement.send'
  | 'delivery.tick'
  | 'quietHours.release'
  | 'sla.check'
  | 'water.dueCheck'
  | 'checklist.dueCheck'
  | 'banner.expire'
  | 'event.publish';

export interface Job<P = unknown> {
  id: string;
  type: JobType;
  runAt: string; // ISODateTime
  payload: P;
  done?: boolean;
}

export class JobQueue {
  private jobs = new Map<string, Job>();

  /** Returns true if the job was newly added, false if `id` already existed (idempotent). */
  enqueue<P>(job: Job<P>): boolean {
    if (this.jobs.has(job.id)) {
      return false;
    }
    this.jobs.set(job.id, job as Job);
    return true;
  }

  has(id: string): boolean {
    return this.jobs.has(id);
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /** Not-done jobs with `runAt <= now`, sorted by (runAt, id) for stable ordering. */
  due(now: string): Job[] {
    return Array.from(this.jobs.values())
      .filter((j) => !j.done && j.runAt <= now)
      .sort((a, b) =>
        a.runAt === b.runAt ? a.id.localeCompare(b.id) : a.runAt.localeCompare(b.runAt),
      );
  }

  markDone(id: string): void {
    const job = this.jobs.get(id);
    if (job) job.done = true;
  }

  cancel(id: string): void {
    this.jobs.delete(id);
  }

  all(): Job[] {
    return Array.from(this.jobs.values());
  }

  pending(): Job[] {
    return this.all().filter((j) => !j.done);
  }

  clear(): void {
    this.jobs.clear();
  }

  size(): number {
    return this.jobs.size;
  }
}
