/**
 * S1–S8 (PRD §15). Empty until each phase lands its scenario
 * (P3 → S1, S2; P4 → S3; P5 → S7; P6 → S6; P7 → S4; P8 → S5; P10 → S8).
 */
import type { Scenario } from './types';

export const scenarios: Scenario[] = [];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
