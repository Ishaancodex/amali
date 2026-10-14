/**
 * Fixed, readable IDs for the 6 complete personas and named staff (PRD
 * §3.2). Unlike the ~420 generated residents (which get `seededId`-derived
 * ids), these are stable literals so other modules — the demo slice's
 * default device, scenario fixtures — can reference them without importing
 * the full seed builder.
 */

export const PERSONA_IDS = {
  layla: 'res_layla',
  james: 'res_james',
  ahmed: 'res_ahmed',
  priya: 'res_priya',
  sofia: 'res_sofia',
  rashid: 'res_rashid',
} as const;

/** Supporting fixed-id household members referenced by scenario fixtures and PRD edge cases. */
export const RELATED_IDS = {
  /** Layla's spouse — PRD §8.1: "if Layla's spouse booked, Layla sees '2 of 3 used (1 by Khalid)'". */
  khalid: 'res_khalid',
  /** Rashid's unit is leased out — amenity rights hold with this tenant (PRD §3.2, §11). */
  rashidTenant: 'res_rashid_tenant',
} as const;

export const CHILD_IDS = {
  omar: 'child_omar',
  noor: 'child_noor',
} as const;

export const STAFF_IDS = {
  guardImran: 'staff_imran',
  guardJoseph: 'staff_joseph',
  crecheMaria: 'staff_maria',
  crecheGrace: 'staff_grace',
  crecheAisha: 'staff_aisha',
  fnbMarco: 'staff_marco',
  fnbKen: 'staff_ken',
  fnbElena: 'staff_elena',
  cmHana: 'staff_hana',
  supervisorVictor: 'staff_victor',
  agentDina: 'staff_dina',
  lifeguardSam: 'staff_sam',
  lifeguardRahul: 'staff_rahul',
  gymLeo: 'staff_leo',
  technicianRavi: 'staff_ravi',
  housekeepingJoy: 'staff_joy',
  housekeepingMark: 'staff_mark',
} as const;

export const UNIT_IDS = {
  layla: 'E-1804',
  james: 'W-2203',
  ahmed: 'E-0712',
  priya: 'PV-05',
  sofia: 'W-PH02',
  rashid: 'W-1107',
} as const;
