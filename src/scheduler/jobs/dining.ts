/**
 * Dining job handlers (PRD §8.4): the T−3h WhatsApp reminder and the
 * +30 min no-show auto-flag. Imported once from `scheduler/registerJobs.ts`.
 */
import { useStore } from '@/store';
import { SYSTEM_ACTOR } from '@/lib/systemActor';
import { schedulerEngine } from '../engine';

schedulerEngine.on<{ reservationId: string }>('dining.reminder', (job, { now }) => {
  useStore
    .getState()
    .dispatch('dining.sendReminder', { reservationId: job.payload.reservationId }, SYSTEM_ACTOR, {
      now,
    });
});

schedulerEngine.on<{ reservationId: string }>('dining.noShowFlag', (job, { now }) => {
  useStore
    .getState()
    .dispatch('dining.autoFlagNoShow', { reservationId: job.payload.reservationId }, SYSTEM_ACTOR, {
      now,
    });
});
