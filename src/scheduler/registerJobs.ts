/**
 * Side-effect entry point: importing this registers every `JobType`
 * handler on `schedulerEngine` (TRD extensibility pattern). Imported once
 * from `store/bootstrap.ts`, alongside `store/commands/registerAll.ts`.
 */
import './jobs/booking';
import './jobs/events';
import './jobs/comms';
