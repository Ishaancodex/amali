/**
 * Comms job handlers (TRD §7.5): same pattern as `jobs/booking.ts` —
 * dispatch a command with the system actor and the job's own `runAt` as
 * `now`. Imported once from `scheduler/registerJobs.ts`.
 */
import { useStore } from '@/store';
import { SYSTEM_ACTOR } from '@/lib/systemActor';
import { schedulerEngine } from '../engine';

schedulerEngine.on<{ announcementId: string }>('announcement.send', (job, { now }) => {
  useStore
    .getState()
    .dispatch(
      'announcement.fireScheduled',
      { announcementId: job.payload.announcementId },
      SYSTEM_ACTOR,
      { now },
    );
});

schedulerEngine.on('delivery.tick', (job, { now }) => {
  useStore.getState().dispatch('comms.tickDeliveries', { runAt: job.runAt }, SYSTEM_ACTOR, { now });
});

schedulerEngine.on('quietHours.release', (job, { now }) => {
  useStore
    .getState()
    .dispatch('comms.releaseQuietHours', { runAt: job.runAt }, SYSTEM_ACTOR, { now });
});
