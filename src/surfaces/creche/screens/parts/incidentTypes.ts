import type { CrecheIncidentType } from '@/types/creche';

/** PRD §8.3 incident types, in the order the log form offers them. */
export const INCIDENT_TYPES: readonly CrecheIncidentType[] = [
  'minor_injury',
  'illness',
  'behaviour',
  'allergy_reaction',
  'facility',
];

export function isIncidentType(category: string): category is CrecheIncidentType {
  return (INCIDENT_TYPES as readonly string[]).includes(category);
}
