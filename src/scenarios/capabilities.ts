/** The six capability areas the demo must prove (PRD §1). */
export type Capability = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';

export const CAPABILITY_LABEL: Record<Capability, string> = {
  C1: 'Capacity and booking control',
  C2: 'Scheduling and programming',
  C3: 'Daily operational updates',
  C4: 'Resident communication',
  C5: 'Operations management',
  C6: 'Reporting and control',
};
