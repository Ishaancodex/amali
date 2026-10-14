import { describe, it, expect, beforeEach } from 'vitest';
import { JobQueue, type Job } from '@/scheduler/queue';
import { SchedulerEngine, applyJump, tickLive } from '@/scheduler/clock';

function job(id: string, runAt: string, type: Job['type'] = 'hold.expire'): Job {
  return { id, type, runAt, payload: {} };
}

describe('scheduler/queue — JobQueue', () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue();
  });

  it('enqueue is idempotent by job id', () => {
    expect(queue.enqueue(job('j1', '2026-10-14T13:00:00.000Z'))).toBe(true);
    // Same id again, even with a different runAt — must be a no-op.
    expect(queue.enqueue(job('j1', '2026-10-15T00:00:00.000Z'))).toBe(false);
    expect(queue.size()).toBe(1);
    expect(queue.get('j1')?.runAt).toBe('2026-10-14T13:00:00.000Z');
  });

  it('due() returns only not-done jobs with runAt <= now, sorted by (runAt, id)', () => {
    queue.enqueue(job('b', '2026-10-14T13:00:00.000Z'));
    queue.enqueue(job('a', '2026-10-14T13:00:00.000Z'));
    queue.enqueue(job('c', '2026-10-14T15:00:00.000Z')); // not due yet
    queue.enqueue(job('d', '2026-10-14T12:00:00.000Z'));

    const due = queue.due('2026-10-14T13:30:00.000Z');
    expect(due.map((j) => j.id)).toEqual(['d', 'a', 'b']); // ordered by runAt, then id
  });

  it('markDone removes a job from due()', () => {
    queue.enqueue(job('j1', '2026-10-14T13:00:00.000Z'));
    queue.markDone('j1');
    expect(queue.due('2026-10-14T14:00:00.000Z')).toHaveLength(0);
    expect(queue.pending()).toHaveLength(0);
  });
});

describe('scheduler/clock — applyJump / tickLive', () => {
  it('+15m / +1h / next_day jump math', () => {
    const now = '2026-10-14T13:30:00.000Z';
    expect(applyJump(now, '+15m')).toBe('2026-10-14T13:45:00.000Z');
    expect(applyJump(now, '+1h')).toBe('2026-10-14T14:30:00.000Z');
    // next_day jumps to the start of the *next* Dubai calendar day.
    expect(applyJump(now, 'next_day')).toBe('2026-10-14T20:00:00.000Z');
  });

  it('tickLive advances by elapsed real time scaled by speed, including sub-minute precision', () => {
    const now = '2026-10-14T13:30:00.000Z';
    // 16ms frame at 1x speed must not round away to nothing.
    expect(tickLive(now, 16, 1)).toBe('2026-10-14T13:30:00.016Z');
    expect(tickLive(now, 1000, 10)).toBe('2026-10-14T13:30:10.000Z');
  });
});

describe('scheduler/clock — SchedulerEngine.runDue', () => {
  it('runs each job exactly once across a multi-day jump, in (runAt, id) order', () => {
    const engine = new SchedulerEngine();
    const order: string[] = [];
    engine.on('hold.expire', (j) => {
      order.push(j.id);
    });

    const start = '2026-10-14T00:00:00.000Z';
    // Jobs scattered across a 3-day span, deliberately out of chronological insertion order.
    engine.queue.enqueue(job('day3', '2026-10-17T00:00:00.000Z'));
    engine.queue.enqueue(job('day1-b', '2026-10-15T09:00:00.000Z'));
    engine.queue.enqueue(job('day1-a', '2026-10-15T08:00:00.000Z'));
    engine.queue.enqueue(job('day2', '2026-10-16T12:00:00.000Z'));

    const threeDaysLater = '2026-10-17T00:00:00.000Z';
    const summary = engine.runDue(threeDaysLater);

    expect(order).toEqual(['day1-a', 'day1-b', 'day2', 'day3']);
    expect(summary.ran).toHaveLength(4);
    expect(summary.byType['hold.expire']).toBe(4);
    expect(summary.truncated).toBe(false);

    // Idempotency: running again at the same (or later) `now` does nothing more —
    // every job is already marked done.
    order.length = 0;
    const secondSummary = engine.runDue(threeDaysLater);
    expect(order).toEqual([]);
    expect(secondSummary.ran).toHaveLength(0);
    void start;
  });

  it("gives each job's handler the job's own runAt as its local `now`", () => {
    const engine = new SchedulerEngine();
    const seenNow: string[] = [];
    engine.on('booking.reminder', (j, ctx) => {
      seenNow.push(ctx.now);
      expect(ctx.now).toBe(j.runAt);
    });

    engine.queue.enqueue(job('r1', '2026-10-15T07:00:00.000Z', 'booking.reminder'));
    engine.queue.enqueue(job('r2', '2026-10-16T07:00:00.000Z', 'booking.reminder'));

    // Jump far past both — each handler must still see its own runAt, not the final `now`.
    engine.runDue('2026-10-20T00:00:00.000Z');
    expect(seenNow).toEqual(['2026-10-15T07:00:00.000Z', '2026-10-16T07:00:00.000Z']);
  });

  it('a handler can enqueue a follow-up job that runs in the same pass if also due', () => {
    const engine = new SchedulerEngine();
    const ran: string[] = [];

    engine.on('hold.expire', (j) => {
      ran.push(j.id);
      if (j.id === 'first') {
        return [job('second', '2026-10-14T13:05:00.000Z')];
      }
      return undefined;
    });

    engine.queue.enqueue(job('first', '2026-10-14T13:00:00.000Z'));
    const summary = engine.runDue('2026-10-14T13:10:00.000Z');

    expect(ran).toEqual(['first', 'second']);
    expect(summary.ran).toHaveLength(2);
  });

  it('enforces a safety guard so a pathological job graph cannot loop forever', () => {
    const engine = new SchedulerEngine();
    let count = 0;
    engine.on('hold.expire', (j) => {
      count += 1;
      // Always spawn one more due job, with a unique id, to try to loop forever.
      return [job(`spawned-${count}`, j.runAt)];
    });

    engine.queue.enqueue(job('seed', '2026-10-14T13:00:00.000Z'));
    const summary = engine.runDue('2026-10-14T13:00:00.000Z');

    expect(summary.truncated).toBe(true);
    expect(summary.ran.length).toBeLessThanOrEqual(5000);
  });
});
