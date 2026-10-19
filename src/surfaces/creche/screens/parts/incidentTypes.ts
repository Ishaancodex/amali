import type { CrecheIncidentType } from '@/types/creche';

/** PRD §8.3 incident types, in the order the log form offers them. */
export const INCIDENT_TYPE_LABEL: Record<CrecheIncidentType, string> = {
  minor_injury: 'Minor injury',
  illness: 'Illness',
  behaviour: 'Behaviour',
  allergy_reaction: 'Allergy reaction',
  facility: 'Facility',
};
