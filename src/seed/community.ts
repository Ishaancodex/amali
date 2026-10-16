/**
 * Community structure and generated residents (PRD §3.3). Deterministic
 * under a given `Rng` stream — the 6 complete personas (seed/personas.ts)
 * are layered on top afterwards, replacing the placeholder resident on
 * their reserved unit.
 */
import { rng, rngBool, rngInt, rngPick, rngShuffle, type Rng } from '@/lib/random';
import { seededId } from '@/lib/random';
import { FIRST_NAMES, LAST_NAMES } from './namePools';
import { UNIT_IDS } from './personaIds';
import type { Unit, Resident, ResidentType } from '@/types/community';
import type { AmenityKey } from '@/types/amenity';

const OPT_IN_TOPICS: readonly AmenityKey[] = [
  'pool',
  'gym',
  'padel',
  'screening',
  'music',
  'dining',
];

/** A resident opts into 0-2 amenity update topics (PRD §8.7's "Opted in to Pool updates" audience). */
function topicOptInsFor(r: Rng): AmenityKey[] {
  const count = rngInt(r, 0, 2);
  return rngShuffle(r, OPT_IN_TOPICS).slice(0, count);
}

const NOW_PLACEHOLDER = '2026-01-01T00:00:00.000Z'; // createdAt for seed-generated rows

function baseEntity(now: string) {
  return { createdAt: now, updatedAt: now };
}

function newUnit(
  now: string,
  id: string,
  kind: Unit['kind'],
  extra: Partial<Pick<Unit, 'tower' | 'floor' | 'cluster'>>,
): Unit {
  return {
    id,
    ...baseEntity(now),
    kind,
    amenityRightsHolderId: '', // filled in once the resident is created
    ...extra,
  };
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last.trim()[0] ?? ''}`.toUpperCase();
}

function phoneFor(r: Rng): string {
  const mid = rngInt(r, 100, 999);
  const end = rngInt(r, 10, 99);
  return `+971 5${rngInt(r, 0, 9)} ${mid} ${end}${rngInt(r, 0, 9)}`;
}

function emailFor(first: string, last: string, r: Rng): string {
  const slug = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
  return `${slug}${rngInt(r, 1, 99)}@example.com`;
}

function generateResident(r: Rng, now: string, unitId: string, type: ResidentType): Resident {
  const first = rngPick(r, FIRST_NAMES);
  const last = rngPick(r, LAST_NAMES);
  return {
    id: seededId(r, 'res'),
    ...baseEntity(now),
    name: `${first} ${last}`,
    avatar: initials(first, last),
    unitId,
    type,
    phone: phoneFor(r),
    email: emailFor(first, last, r),
    channels: {
      appPush: rngBool(r, 0.85),
      whatsapp: rngBool(r, 0.9),
      whatsappOptIn: rngBool(r, 0.85),
      appInstalled: rngBool(r, 0.95),
    },
    topicOptIns: topicOptInsFor(r),
    locale: 'en',
    walletRole: type === 'household' ? 'spender' : 'primary',
  };
}

export interface CommunityBuild {
  units: Record<string, Unit>;
  residents: Record<string, Resident>;
}

function addEastTower(seedRng: Rng, now: string, units: Record<string, Unit>): void {
  const unitsPerFloor = 3;
  for (let floor = 1; floor <= 32; floor += 1) {
    for (let u = 1; u <= unitsPerFloor; u += 1) {
      const id = `E-${String(floor).padStart(2, '0')}${String(u).padStart(2, '0')}`;
      units[id] = newUnit(now, id, 'apartment', { tower: 'east', floor });
    }
  }
  for (const floor of [30, 31, 32]) {
    const id = `E-DX${floor}`;
    units[id] = newUnit(now, id, 'duplex', { tower: 'east', floor });
  }
  void seedRng; // reserved for future per-unit variation
}

function addWestTower(seedRng: Rng, now: string, units: Record<string, Unit>): void {
  const unitsPerFloor = 4;
  for (let floor = 1; floor <= 28; floor += 1) {
    for (let u = 1; u <= unitsPerFloor; u += 1) {
      const id = `W-${String(floor).padStart(2, '0')}${String(u).padStart(2, '0')}`;
      units[id] = newUnit(now, id, 'apartment', { tower: 'west', floor });
    }
  }
  for (let p = 1; p <= 4; p += 1) {
    const id = `W-PH${String(p).padStart(2, '0')}`;
    units[id] = newUnit(now, id, 'penthouse', { tower: 'west' });
  }
  void seedRng;
}

function addPodiumVillas(now: string, units: Record<string, Unit>): void {
  for (let v = 1; v <= 6; v += 1) {
    const id = `PV-${String(v).padStart(2, '0')}`;
    units[id] = newUnit(now, id, 'villa', { cluster: 'north' });
  }
  for (let v = 7; v <= 12; v += 1) {
    const id = `PV-${String(v).padStart(2, '0')}`;
    units[id] = newUnit(now, id, 'villa', { cluster: 'south' });
  }
}

/** Ensures the 6 fixed persona unit codes exist, even if the grid above didn't generate them. */
function ensurePersonaUnits(now: string, units: Record<string, Unit>): void {
  const defs: {
    id: string;
    kind: Unit['kind'];
    extra: Partial<Pick<Unit, 'tower' | 'floor' | 'cluster'>>;
  }[] = [
    { id: UNIT_IDS.layla, kind: 'apartment', extra: { tower: 'east', floor: 18 } },
    { id: UNIT_IDS.james, kind: 'apartment', extra: { tower: 'west', floor: 22 } },
    { id: UNIT_IDS.ahmed, kind: 'apartment', extra: { tower: 'east', floor: 7 } },
    { id: UNIT_IDS.priya, kind: 'villa', extra: { cluster: 'north' } },
    { id: UNIT_IDS.sofia, kind: 'penthouse', extra: { tower: 'west' } },
    { id: UNIT_IDS.rashid, kind: 'apartment', extra: { tower: 'west', floor: 11 } },
  ];
  for (const def of defs) {
    if (!units[def.id]) {
      units[def.id] = newUnit(now, def.id, def.kind, def.extra);
    }
  }
}

const RESERVED_UNIT_IDS: readonly string[] = Object.values(UNIT_IDS);

/** Builds ~230 units and ~400-430 residents (PRD §3.3: "about 240 units and ~420 residents"). */
export function buildCommunity(seed: string, now: string = NOW_PLACEHOLDER): CommunityBuild {
  const units: Record<string, Unit> = {};
  const residents: Record<string, Resident> = {};

  const unitRng = rng(seed, 'community', 'units');
  addEastTower(unitRng, now, units);
  addWestTower(unitRng, now, units);
  addPodiumVillas(now, units);
  ensurePersonaUnits(now, units);

  const residentRng = rng(seed, 'community', 'residents');
  for (const unit of Object.values(units)) {
    if (RESERVED_UNIT_IDS.includes(unit.id)) continue; // personas.ts fills these in

    const type: ResidentType = rngBool(residentRng, 0.7) ? 'owner' : 'tenant';
    const primary = generateResident(residentRng, now, unit.id, type);
    residents[primary.id] = primary;
    unit.amenityRightsHolderId = primary.id;

    if (rngBool(residentRng, 0.8)) {
      const householder = generateResident(residentRng, now, unit.id, 'household');
      residents[householder.id] = householder;
    }
  }

  return { units, residents };
}
