/**
 * Creche job handlers (PRD §8.3): the T−15 pickup reminder, the late-pickup
 * chase after grace, and the end-of-day sweep. Imported once from
 * `scheduler/registerJobs.ts`.
 */
import { useStore } from '@/store';
import { SYSTEM_ACTOR } from '@/lib/systemActor';
import { schedulerEngine } from '../engine';

schedulerEngine.on<{ bookingId: string }>('creche.pickupReminder', (job, { now }) => {
  useStore
    .getState()
    .dispatch('creche.pickupReminder', { bookingId: job.payload.bookingId }, SYSTEM_ACTOR, { now });
});

schedulerEngine.on<{ bookingId: string }>('creche.latePickup', (job, { now }) => {
  useStore
    .getState()
    .dispatch('creche.latePickup', { bookingId: job.payload.bookingId }, SYSTEM_ACTOR, { now });
});

schedulerEngine.on<{ date: string }>('creche.endOfDaySweep', (job, { now }) => {
  useStore
    .getState()
    .dispatch('creche.endOfDaySweep', { date: job.payload.date }, SYSTEM_ACTOR, { now });
});
