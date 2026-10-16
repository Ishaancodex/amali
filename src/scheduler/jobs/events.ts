/**
 * Event/RSVP job handlers (PRD §8.2) — same pattern as `jobs/booking.ts`:
 * dispatch a command with the system actor and the job's own `runAt` as
 * `now`. Imported once from `scheduler/registerJobs.ts`.
 */
import { useStore } from '@/store';
import { SYSTEM_ACTOR } from '@/lib/systemActor';
import { schedulerEngine } from '../engine';

schedulerEngine.on<{ rsvpId: string }>('rsvp.holdExpire', (job, { now }) => {
  useStore
    .getState()
    .dispatch('rsvp.releaseExpiredHold', { rsvpId: job.payload.rsvpId }, SYSTEM_ACTOR, { now });
});

schedulerEngine.on<{ waitlistEntryId: string }>('eventWaitlist.offerExpire', (job, { now }) => {
  useStore
    .getState()
    .dispatch(
      'eventWaitlist.expireOffer',
      { waitlistEntryId: job.payload.waitlistEntryId },
      SYSTEM_ACTOR,
      { now },
    );
});

schedulerEngine.on<{ rsvpId: string; label: 'T-24h' | 'T-2h' }>(
  'event.reminder',
  (job, { now }) => {
    useStore
      .getState()
      .dispatch(
        'rsvp.sendReminder',
        { rsvpId: job.payload.rsvpId, label: job.payload.label },
        SYSTEM_ACTOR,
        { now },
      );
  },
);
