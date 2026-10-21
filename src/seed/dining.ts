/**
 * Dining seed (PRD §8.4, §15 S5): the Restaurant's 17 tables (6×2, 8×4,
 * 3×6 across Indoor · Terrace · Canal view, adjacent ones combinable), the
 * Private Dining Room and the 10-seat Teppanyaki counter; a week of served
 * covers (with walk-ins and the odd no-show) for the covers chart and
 * forecast; and today's book — Restaurant lunch/dinner, Teppanyaki at
 * 19:00 and a party of 2 at 21:00 whose deposit is held (S5's no-show).
 * Diners' units get a wallet if they don't have one. Deterministic under
 * `(seed, now)`.
 */
import { rng, rngInt, rngPick } from '@/lib/random';
import { rules } from '@/config/rules';
import { addDaysIso, addMinutesIso, dubaiDateKey, dubaiDateTimeToIso } from '@/lib/time';
import { aedToFils } from '@/lib/money';
import { tableMinutes } from '@/domain/dining/periods';
import type { Job } from '@/scheduler/queue';
import { diningJobs } from '@/store/commands/diningJobs';
import type { Resident } from '@/types/community';
import type { Reservation, Table, TableZone, VenueKey } from '@/types/dining';
import type { Wallet, WalletHold } from '@/types/wallet';
import { UNIT_IDS } from './personaIds';

const dining = rules.dining;

/** id, seats, zone, x, y (floor-plan %), combinable neighbours. */
const RESTAURANT: [string, number, TableZone, number, number, string[]][] = [
  ['T1', 2, 'indoor', 12, 18, ['T2']],
  ['T2', 2, 'indoor', 26, 18, ['T1']],
  ['T3', 2, 'indoor', 40, 18, []],
  ['T4', 4, 'indoor', 12, 42, ['T5']],
  ['T5', 4, 'indoor', 30, 42, ['T4', 'T7']],
  ['T6', 4, 'indoor', 48, 42, []],
  ['T7', 6, 'indoor', 22, 68, ['T5']],
  ['T8', 2, 'terrace', 66, 14, ['T9']],
  ['T9', 2, 'terrace', 80, 14, ['T8']],
  ['T10', 4, 'terrace', 66, 38, ['T11']],
  ['T11', 4, 'terrace', 84, 38, ['T10', 'T12']],
  ['T12', 6, 'terrace', 74, 62, ['T11']],
  ['T13', 2, 'canal', 52, 90, []],
  ['T14', 4, 'canal', 66, 88, ['T15', 'T16']],
  ['T15', 4, 'canal', 82, 88, ['T14']],
  ['T16', 6, 'canal', 36, 90, ['T14']],
  ['T17', 4, 'canal', 92, 76, []],
];

function table(
  now: string,
  id: string,
  venue: VenueKey,
  seats: number,
  zone: TableZone,
  x: number,
  y: number,
  combinableWith: string[],
): Table {
  return { id, createdAt: now, updatedAt: now, venue, seats, zone, x, y, combinableWith };
}

export function buildTables(now: string): Record<string, Table> {
  const list = [
    ...RESTAURANT.map(([id, seats, zone, x, y, comb]) =>
      table(now, id, 'restaurant', seats, zone, x, y, comb),
    ),
    table(now, 'PDR', 'pdr', dining.pdr.partySize.max, 'private', 50, 50, []),
    table(now, 'COUNTER', 'teppanyaki', dining.teppanyaki.seats, 'counter', 50, 50, []),
  ];
  return Object.fromEntries(list.map((t) => [t.id, t]));
}

export interface DiningSeed {
  tables: Record<string, Table>;
  reservations: Record<string, Reservation>;
  wallets: Record<string, Wallet>;
  walletHolds: Record<string, WalletHold>;
  jobs: Record<string, Job>;
}

/** The Teppanyaki couple at 21:00 who never arrive (S5 step 3). */
export const SEEDED_NO_SHOW_ID = 'res_dine_seed_noshow';

/** '' = no occasion (rngPick can't pick `undefined`). */
const OCCASIONS = ['', '', '', 'Birthday', 'Anniversary', 'Business'];
const DIETARY = [[], [], [], ['vegetarian'], ['nut allergy'], ['gluten-free']] as string[][];

export function buildDining(
  seed: string,
  now: string,
  residents: Record<string, Resident>,
  existingWallets: Record<string, Wallet>,
): DiningSeed {
  const r = rng(seed, 'dining');
  const tables = buildTables(now);
  const personaUnits = new Set<string>(Object.values(UNIT_IDS));
  const diners = Object.values(residents)
    .filter((p) => (p.type === 'owner' || p.type === 'tenant') && !personaUnits.has(p.unitId))
    .sort((a, b) => a.id.localeCompare(b.id));
  const reservations: Record<string, Reservation> = {};
  const wallets: Record<string, Wallet> = {};
  const walletHolds: Record<string, WalletHold> = {};
  const jobs: Record<string, Job> = {};
  let n = 0;

  const add = (
    venue: VenueKey,
    start: string,
    partySize: number,
    tableIds: string[],
    state: Reservation['state'],
    extra: Partial<Reservation> = {},
  ): Reservation => {
    const diner = diners[(n * 13) % diners.length]!;
    const id = extra.id ?? `res_dine_seed_${n}`;
    n += 1;
    const res: Reservation = {
      id,
      createdAt: addDaysIso(start, -rngInt(r, 1, 6)),
      updatedAt: now,
      venue,
      residentId: diner.id,
      unitId: diner.unitId,
      start,
      end: addMinutesIso(start, tableMinutes(venue, partySize, dining)),
      period: 'dinner',
      partySize,
      dietary: rngPick(r, DIETARY),
      occasion: rngPick(r, OCCASIONS) || undefined,
      tableIds,
      mode: 'instant',
      state,
      ...extra,
    };
    reservations[id] = res;
    wallets[diner.unitId] ??= existingWallets[diner.unitId] ?? {
      unitId: diner.unitId,
      balanceFils: aedToFils(rngInt(r, 8, 30) * 100),
    };
    return res;
  };

  // A week of served covers: lunch and dinner, a couple of walk-ins each, the odd no-show.
  const todayKey = dubaiDateKey(now);
  for (let d = 7; d >= 1; d -= 1) {
    const dateKey = dubaiDateKey(addDaysIso(now, -d));
    for (const [period, times] of [
      ['lunch', ['12:30', '13:00', '13:30']],
      ['dinner', ['19:00', '19:30', '20:00', '20:30']],
    ] as const) {
      const sitting = rngInt(r, 3, 6);
      for (let i = 0; i < sitting; i += 1) {
        const t = RESTAURANT[(i * 3 + d) % RESTAURANT.length]!;
        const walkIn = i < 2;
        add(
          'restaurant',
          dubaiDateTimeToIso(dateKey, rngPick(r, times)),
          Math.min(t[1], rngInt(r, 2, 4)),
          [t[0]],
          i === sitting - 1 && d === 6 ? 'no_show' : 'completed',
          {
            period,
            walkIn,
            dietary: walkIn ? [] : rngPick(r, DIETARY),
          },
        );
      }
    }
  }

  // Today's book. Times already past at `now` read as completed (lunch) or seated (dinner in progress).
  const today = (hhmm: string) => dubaiDateTimeToIso(todayKey, hhmm);
  const pastOrNot = (start: string, seatedState: Reservation['state']) =>
    start <= now ? seatedState : 'confirmed';
  for (const [hhmm, size, tableId] of [
    ['12:30', 2, 'T1'],
    ['12:45', 4, 'T10'],
    ['13:15', 3, 'T5'],
  ] as const) {
    add(
      'restaurant',
      today(hhmm),
      size,
      [tableId],
      pastOrNot(addMinutesIso(today(hhmm), 120), 'completed'),
      { period: 'lunch' },
    );
  }
  for (const [hhmm, size, tableId] of [
    ['18:30', 2, 'T2'],
    ['19:00', 4, 'T4'],
    ['19:00', 2, 'T8'],
    ['19:30', 6, 'T7'],
    ['19:30', 4, 'T6'],
    ['20:00', 2, 'T13'],
    ['20:00', 4, 'T11'],
    ['20:30', 3, 'T14'],
    ['21:00', 2, 'T3'],
  ] as const) {
    add('restaurant', today(hhmm), size, [tableId], pastOrNot(today(hhmm), 'seated'), {
      period: 'dinner',
    });
  }
  // Teppanyaki: 19:00 has 6 of 10 seats; 21:00 a party of 2 with its deposit held.
  add('teppanyaki', today('19:00'), 4, ['COUNTER'], pastOrNot(today('19:00'), 'seated'));
  add('teppanyaki', today('19:00'), 2, ['COUNTER'], pastOrNot(today('19:00'), 'seated'));
  const late = add('teppanyaki', today('21:00'), 2, ['COUNTER'], 'confirmed', {
    id: SEEDED_NO_SHOW_ID,
    occasion: 'Anniversary',
  });
  const holdFils = dining.teppanyaki.depositPerPersonFils * late.partySize;
  const holdId = `hold_seed_${late.id}`;
  walletHolds[holdId] = {
    id: holdId,
    createdAt: late.createdAt,
    updatedAt: late.createdAt,
    unitId: late.unitId,
    fils: holdFils,
    label: 'Teppanyaki deposit',
    ref: { type: 'reservation', id: late.id },
    state: 'active',
  };
  late.depositHoldId = holdId;

  // Future reservations still get their reminder and no-show auto-flag.
  for (const res of Object.values(reservations)) {
    if (res.state !== 'confirmed') continue;
    for (const job of diningJobs(res)) if (job.runAt > now) jobs[job.id] = job;
  }

  return { tables, reservations, wallets, walletHolds, jobs };
}

/**
 * The evening so far (S5's 21:00 starting point): every seeded party due
 * by `at` has been seated — except the Teppanyaki couple who never come.
 * Idempotent.
 */
export function seatEveningSoFar(
  state: { reservations: Record<string, Reservation> },
  at: string,
): void {
  for (const r of Object.values(state.reservations)) {
    if (!r.id.startsWith('res_dine_seed_') || r.id === SEEDED_NO_SHOW_ID) continue;
    if (r.state !== 'confirmed' || r.start > at) continue;
    r.state = 'seated';
    r.seatedAt = addMinutesIso(r.start, 5);
    r.updatedAt = r.seatedAt;
  }
}
