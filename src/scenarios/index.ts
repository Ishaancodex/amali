/**
 * S1–S8 (PRD §15). S1/S2 land with P3, S3 with P4, S7 with P5; the rest
 * are empty until their phases land (P6 → S6; P7 → S4; P8 → S5; P10 → S8).
 */
import type { Scenario } from './types';
import { s1Padel } from './s1-padel';
import { s2Blackout } from './s2-blackout';
import { s3Screening } from './s3-screening';
import { s7Comms } from './s7-comms';

export const scenarios: Scenario[] = [s1Padel, s2Blackout, s3Screening, s7Comms];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
