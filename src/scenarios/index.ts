/**
 * S1–S8 (PRD §15). S1/S2 land with P3, S3 with P4, S7 with P5, S6 with P6, S4 with P7; the rest
 * are empty until their phases land (P8 → S5; P10 → S8).
 */
import type { Scenario } from './types';
import { s1Padel } from './s1-padel';
import { s2Blackout } from './s2-blackout';
import { s3Screening } from './s3-screening';
import { s4Creche } from './s4-creche';
import { s6PoolGym } from './s6-pool-gym';
import { s7Comms } from './s7-comms';

export const scenarios: Scenario[] = [
  s1Padel,
  s2Blackout,
  s3Screening,
  s4Creche,
  s6PoolGym,
  s7Comms,
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
