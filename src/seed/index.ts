/**
 * `buildSeed(seed, now) → full state` (TRD §11, §16.3). Pure function: the
 * same `seed` string and `now` always produce byte-identical output. Phase
 * P0 seeds community, personas, staff, vendors and amenities; every other
 * domain starts empty until its phase lands (bookings in P3, events in P4,
 * and so on) or a scenario fixture populates it.
 */
import type { AppState } from '@/store/types';
import { defaultDemoState, SEED_NAME } from '@/store/slices/demo';
import { buildCommunity } from './community';
import { buildPersonas } from './personas';
import { buildStaff } from './staff';
import { buildVendors } from './vendors';
import { buildAmenities } from './amenities';
import { buildWeeklyHours } from './hours';
import { buildAmenityStatus } from './amenityStatus';
import { buildChecklistTemplates } from './checklistTemplates';
import { buildShifts } from './shifts';
import { buildWaterReadings } from './waterReadings';

export function buildSeed(seed: string = SEED_NAME, now?: string): AppState {
  const demo = defaultDemoState(now, seed);
  const seedNow = now ?? demo.clock.now;

  const community = buildCommunity(seed, seedNow);
  const personas = buildPersonas(seedNow);

  // Layer the 6 personas onto the generated community: their residents/children/
  // guardians, plus unit field overrides (rights holder, lease end).
  const units = { ...community.units };
  for (const [unitId, overrides] of Object.entries(personas.unitOverrides)) {
    units[unitId] = { ...units[unitId], ...overrides } as (typeof units)[string];
  }
  const residents = { ...community.residents, ...personas.residents };

  return {
    units,
    residents,
    children: personas.children,
    guardians: personas.guardians,
    staff: buildStaff(seedNow),
    vendors: buildVendors(seedNow),

    amenities: buildAmenities(),
    amenityStatus: buildAmenityStatus(seed, seedNow),
    hours: buildWeeklyHours(),
    exceptions: {},
    blackouts: {},

    bookings: {},
    holds: {},
    waitlist: {},
    strikes: {},
    suspensions: {},

    events: {},
    showtimes: {},
    rsvps: {},
    seasons: {},

    crecheSessions: {},
    crecheBookings: {},
    bandAssignments: [],

    tables: {},
    reservations: {},

    wallets: personas.wallets,
    ledger: {},

    checklistTemplates: buildChecklistTemplates(seedNow),
    checklistRuns: {},
    cleaningLogs: {},
    waterReadings: buildWaterReadings(seed, seedNow),
    shifts: buildShifts(seed, seedNow),
    incidents: {},
    workOrders: {},
    occupancy: {},

    announcements: {},
    deliveries: {},
    waMessages: {},
    channelPosts: {},

    notifications: {},
    auditLog: [],
    jobs: {},

    demo,
  };
}
