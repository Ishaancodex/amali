/**
 * Scenarios as data (TRD §10, PRD §15). One definition drives the notes
 * panel, "Take me there", and the headless scenario tests
 * (`tests/scenarios/*`, from Phase P3 onward).
 */
import type { AppState } from '@/store/types';
import type { Actor } from '@/types/common';
import type { ConsoleRole, Role } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import type { Capability as CapabilityArea } from './capabilities';

export interface ScenarioDeviceSetup {
  role: Role;
  actorId: string;
  consoleRole?: ConsoleRole;
  deepLink?: string;
}

export interface ScenarioStepSetup {
  clock?: string | { jump: string };
  dualView?: boolean;
  devices: Partial<Record<'A' | 'B', ScenarioDeviceSetup>>;
  /**
   * State the presenter jumps into at this step, applied after the clock
   * (e.g. S4's other 11 children already in the room at 09:04). Must be
   * idempotent — "Take me there" can be clicked more than once.
   */
  fixtures?: (draft: AppState) => void;
}

export interface ScenarioScriptEntry {
  command: string;
  /**
   * Static input, or a function of the state *as of just before this entry
   * runs* — needed once a scenario's later steps act on something an
   * earlier step created (e.g. cancelling the very booking step 1 made),
   * since a command's generated id isn't known when the scenario is
   * authored as data.
   */
  input: unknown | ((s: AppState) => unknown);
  actor: Actor;
  /** For an 'assigned'-scoped capability (e.g. an amenity supervisor) — the amenities this actor is assigned to, same as `dispatch()`'s own `opts.assignedAmenities`. */
  assignedAmenities?: AmenityKey[];
}

export interface ScenarioStep {
  title: string;
  body: string;
  setup?: ScenarioStepSetup;
  /** Commands a presenter would perform live — run by the headless scenario tests, not by "Take me there". */
  script?: ScenarioScriptEntry[];
  expect?: (s: AppState) => void;
}

export interface Scenario {
  id: string;
  title: string;
  capability: CapabilityArea[];
  startAt: string;
  fixtures?: (draft: AppState) => void;
  steps: ScenarioStep[];
}
