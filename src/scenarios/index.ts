/**
 * S1–S8 (PRD §15). S1/S2 land with P3, S3 with P4; the rest are empty
 * until their phases land (P5 → S7; P6 → S6; P7 → S4; P8 → S5; P10 → S8).
 */
import type { Scenario } from './types';
import { s1Padel } from './s1-padel';
import { s2Blackout } from './s2-blackout';
import { s3Screening } from './s3-screening';

export const scenarios: Scenario[] = [s1Padel, s2Blackout, s3Screening];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
