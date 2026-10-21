/**
 * S1–S8 (PRD §15). S1/S2 land with P3, S3 with P4, S7 with P5, S6 with P6, S4 with P7, S5 with P8, S8 with P10.
 */
import type { Scenario } from './types';
import { s1Padel } from './s1-padel';
import { s2Blackout } from './s2-blackout';
import { s3Screening } from './s3-screening';
import { s4Creche } from './s4-creche';
import { s5Dining } from './s5-dining';
import { s6PoolGym } from './s6-pool-gym';
import { s7Comms } from './s7-comms';
import { s8Management } from './s8-management';

export const scenarios: Scenario[] = [
  s1Padel,
  s2Blackout,
  s3Screening,
  s4Creche,
  s5Dining,
  s6PoolGym,
  s7Comms,
  s8Management,
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
