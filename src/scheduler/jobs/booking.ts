/**
 * Padel job handlers (TRD extensibility pattern: `schedulerEngine.on(type,
 * handler)` once per `JobType`). Handlers never touch `AppState` directly —
 * they dispatch a command with the system actor, passing the job's own
 * `runAt` as `now` (TRD §7.4: each job keeps its own timeline position
 * even inside a multi-day jump that fires several jobs in one sweep), so
 * the scheduler job-bridge (store/commands/dispatch.ts) stays the single
 * place jobs get created and mirrored. Imported once from
 * `scheduler/registerJobs.ts`.
 */
import { useStore } from '@/store';
import { SYSTEM_ACTOR } from '@/lib/systemActor';
import { schedulerEngine } from '../engine';

schedulerEngine.on<{ bookingId: string }>('hold.expire', (job, { now }) => {
  useStore
    .getState()
    .dispatch('booking.releaseExpiredHold', { bookingId: job.payload.bookingId }, SYSTEM_ACTOR, {
      now,
    });
});

schedulerEngine.on<{ waitlistEntryId: string }>('waitlist.offerExpire', (job, { now }) => {
  useStore
    .getState()
    .dispatch(
      'waitlist.expireOffer',
      { waitlistEntryId: job.payload.waitlistEntryId },
      SYSTEM_ACTOR,
      { now },
    );
});

schedulerEngine.on<{ bookingId: string }>('booking.noShowSweep', (job, { now }) => {
  useStore
    .getState()
    .dispatch('booking.markNoShow', { bookingId: job.payload.bookingId }, SYSTEM_ACTOR, { now });
});
