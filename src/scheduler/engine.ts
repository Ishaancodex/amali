/**
 * The single shared scheduler engine instance. Each phase's job handlers
 * (`scheduler/jobs/*`) call `schedulerEngine.on(type, handler)` once at
 * module load to register themselves.
 */
import { SchedulerEngine } from './clock';

export const schedulerEngine = new SchedulerEngine();
