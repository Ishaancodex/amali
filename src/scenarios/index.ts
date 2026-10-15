/**
 * S1–S8 (PRD §15). S1/S2 land with P3; the rest are empty until their
 * phases land (P4 → S3; P5 → S7; P6 → S6; P7 → S4; P8 → S5; P10 → S8).
 */
import type { Scenario } from './types';
import { s1Padel } from './s1-padel';
import { s2Blackout } from './s2-blackout';

export const scenarios: Scenario[] = [s1Padel, s2Blackout];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
