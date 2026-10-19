/**
 * Ops job handlers (TRD extensibility pattern): the SLA breach sweep.
 * Imported once from `scheduler/registerJobs.ts`.
 */
import { useStore } from '@/store';
import { SYSTEM_ACTOR } from '@/lib/systemActor';
import { schedulerEngine } from '../engine';

schedulerEngine.on('sla.check', (job, { now }) => {
  useStore.getState().dispatch('ops.slaSweep', { runAt: job.runAt }, SYSTEM_ACTOR, { now });
});
