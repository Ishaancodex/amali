/**
 * Scenarios as data (TRD §10, PRD §15). One definition drives the notes
 * panel, "Take me there", and the headless scenario tests
 * (`tests/scenarios/*`, from Phase P3 onward).
 */
import type { AppState } from '@/store/types';
import type { Actor } from '@/types/common';
import type { ConsoleRole, Role } from '@/types/demo';
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
