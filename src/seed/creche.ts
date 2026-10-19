/**
 * The Kids' Club seed (PRD §8.3, §15 S4): morning and afternoon sessions
 * from yesterday to the end of the booking window, the band roster
 * (Kids = Grace + Aisha → 2 × 8 = 16), and 16 generated children across
 * the community's units — 11 in the Kids band, all booked for today's
 * morning session, so Omar makes 12/16. One child has a nanny whose
 * authorisation has expired and another has a nanny pending approval,
 * so the directory's edge cases are real data. Deterministic under
 * `(seed, now)`.
 */
import { rng, rngInt, rngPick, type Rng } from '@/lib/random';
import { rules } from '@/config/rules';
import { addDaysIso, addMinutesIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import { crecheSessionId as sessionId } from '@/domain/creche/sessionIds';
import { FIRST_NAMES } from './namePools';
import { STAFF_IDS, UNIT_IDS } from './personaIds';
import type { Resident } from '@/types/community';
import type {
  AgeBand,
  BandAssignment,
  Child,
  CrecheBooking,
  CrecheSession,
  Guardian,
} from '@/types/creche';

const BAND_STAFF: Record<AgeBand, string[]> = {
  toddlers: [STAFF_IDS.crecheFatima],
  kids: [STAFF_IDS.crecheGrace, STAFF_IDS.crecheAisha],
  juniors: [STAFF_IDS.crecheNadia],
};

/** How many generated children per band, all booked into today's morning session. */
const SEEDED_PER_BAND: Record<AgeBand, number> = { toddlers: 3, kids: 11, juniors: 2 };
const AFTERNOON_KIDS = 4;
/** Not the persona children's names — two "Omar"s at the creche desk would make S4 ambiguous. */
const CHILD_FIRST_NAMES = FIRST_NAMES.filter((n) => n !== 'Omar' && n !== 'Noor');
const SESSION_DAYS_BEFORE = 1;

export { sessionId };

function dobForAge(r: Rng, now: string, age: number): string {
  // Mid-year offset so an `age` here is the same whole-year age on every day of the demo window.
  return dubaiDateKey(addDaysIso(now, -(age * 365 + rngInt(r, 30, 300))));
}

function lastName(fullName: string): string {
  return fullName.split(' ').slice(1).join(' ') || fullName;
}

export interface CrecheSeed {
  children: Record<string, Child>;
  guardians: Record<string, Guardian>;
  crecheSessions: Record<string, CrecheSession>;
  crecheBookings: Record<string, CrecheBooking>;
  bandAssignments: BandAssignment[];
}

export function buildCreche(
  seed: string,
  now: string,
  residents: Record<string, Resident>,
): CrecheSeed {
  const r = rng(seed, 'creche');
  const todayKey = dubaiDateKey(now);

  const crecheSessions: Record<string, CrecheSession> = {};
  const bandAssignments: BandAssignment[] = [];
  for (let d = -SESSION_DAYS_BEFORE; d <= rules.creche.bookingWindowDays; d += 1) {
    const dateKey = dubaiDateKey(addDaysIso(now, d));
    for (const kind of ['morning', 'afternoon'] as const) {
      const times = rules.creche.sessions[kind];
      const id = sessionId(dateKey, kind);
      crecheSessions[id] = {
        id,
        createdAt: now,
        updatedAt: now,
        date: dateKey,
        start: dubaiDateTimeToIso(dateKey, times.start),
        end: dubaiDateTimeToIso(dateKey, times.end),
        kind,
      };
    }
    for (const band of ['toddlers', 'kids', 'juniors'] as const) {
      bandAssignments.push({ date: dateKey, band, staffIds: [...BAND_STAFF[band]] });
    }
  }

  // Parents: owner/tenant residents of generated units (not a persona's unit), in a stable order.
  const personaUnits = new Set<string>(Object.values(UNIT_IDS));
  const parents = Object.values(residents)
    .filter((p) => (p.type === 'owner' || p.type === 'tenant') && !personaUnits.has(p.unitId))
    .sort((a, b) => a.id.localeCompare(b.id));

  const children: Record<string, Child> = {};
  const guardians: Record<string, Guardian> = {};
  const crecheBookings: Record<string, CrecheBooking> = {};
  const morning = sessionId(todayKey, 'morning');
  const afternoon = sessionId(todayKey, 'afternoon');
  let n = 0;

  for (const band of ['toddlers', 'kids', 'juniors'] as const) {
    const { minAge, maxAge } = rules.creche.bands[band];
    for (let i = 0; i < SEEDED_PER_BAND[band]; i += 1) {
      const parent = parents[(n * 7) % parents.length]!;
      const childId = `child_seed_${n}`;
      const guardianId = `guardian_seed_${n}`;
      const guardianIds = [guardianId];

      guardians[guardianId] = {
        id: guardianId,
        createdAt: now,
        updatedAt: now,
        childIds: [childId],
        name: parent.name,
        relation: 'Parent',
        phone: parent.phone,
        photo: parent.avatar,
        idLast4: String(rngInt(r, 1000, 9999)),
        residentId: parent.id,
        approval: 'approved',
      };

      // Two nannies: one whose contract has ended (blocked at check-out), one awaiting the lead.
      if (n === 1 || n === 5) {
        const nannyId = `guardian_seed_${n}_nanny`;
        guardianIds.push(nannyId);
        guardians[nannyId] = {
          id: nannyId,
          createdAt: now,
          updatedAt: now,
          childIds: [childId],
          name: n === 1 ? 'Rosa Dela Cruz' : 'Mercy Okafor',
          relation: 'Nanny',
          phone: `+971 56 ${rngInt(r, 100, 999)} ${rngInt(r, 1000, 9999)}`,
          photo: n === 1 ? 'RD' : 'MO',
          idLast4: String(rngInt(r, 1000, 9999)),
          approval: n === 1 ? 'approved' : 'pending',
          validUntil: n === 1 ? addDaysIso(now, -3) : undefined,
        };
      }

      const first = rngPick(r, CHILD_FIRST_NAMES);
      children[childId] = {
        id: childId,
        createdAt: now,
        updatedAt: now,
        unitId: parent.unitId,
        name: `${first} ${lastName(parent.name)}`,
        dob: dobForAge(r, now, rngInt(r, minAge, maxAge)),
        photo: `${first[0]}${lastName(parent.name)[0] ?? ''}`.toUpperCase(),
        allergies: n === 3 ? { text: 'Dairy', severe: false } : undefined,
        photoConsent: n % 4 !== 0,
        guardianIds,
        emergencyContact: { name: parent.name, phone: parent.phone },
      };

      const booked = addMinutesIso(now, -rngInt(r, 60 * 6, 60 * 72));
      crecheBookings[`crbk_seed_${n}`] = {
        id: `crbk_seed_${n}`,
        createdAt: booked,
        updatedAt: booked,
        sessionId: morning,
        childId,
        bookedBy: parent.id,
        band,
        state: 'confirmed',
      };
      if (band === 'kids' && i < AFTERNOON_KIDS) {
        crecheBookings[`crbk_seed_${n}_pm`] = {
          id: `crbk_seed_${n}_pm`,
          createdAt: booked,
          updatedAt: booked,
          sessionId: afternoon,
          childId,
          bookedBy: parent.id,
          band,
          state: 'confirmed',
        };
      }
      n += 1;
    }
  }

  return { children, guardians, crecheSessions, crecheBookings, bandAssignments };
}

/**
 * The seeded morning children arriving (S4 step 2's starting point: "the
 * board shows Kids band 12/16" needs the other 11 already in the room).
 * Checks each seeded morning booking in a minute apart from the session
 * start, with its own approved parent guardian. Idempotent.
 */
export function arriveSeededMorning(
  state: {
    crecheBookings: Record<string, CrecheBooking>;
    crecheSessions: Record<string, CrecheSession>;
    children: Record<string, Child>;
  },
  dateKey: string,
): void {
  const session = state.crecheSessions[sessionId(dateKey, 'morning')];
  if (!session) return;
  const seeded = Object.values(state.crecheBookings)
    .filter(
      (b) => b.sessionId === session.id && b.id.startsWith('crbk_seed_') && b.state === 'confirmed',
    )
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  seeded.forEach((b, i) => {
    const at = addMinutesIso(session.start, Math.floor(i / 4));
    b.state = 'checked_in';
    b.updatedAt = at;
    b.checkIn = {
      at,
      by: i % 2 === 0 ? STAFF_IDS.crecheGrace : STAFF_IDS.crecheAisha,
      guardianId: state.children[b.childId]?.guardianIds[0] ?? '',
    };
  });
}
