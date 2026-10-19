/**
 * Reservation checks (PRD §8.4), in order: party size, window and lead
 * time, a real start time, table/counter availability, then the deposit
 * against what's available in the wallet. A Restaurant party of 9+ is a
 * manager "Request" — it skips allocation (the manager seats it). Returns
 * the shared `RuleRejection` shape so the UI handles it like every other.
 */
import { addDaysIso, addHoursIso, addMinutesIso, dubaiDateKey } from '@/lib/time';
import { reject, type RuleRejection } from '@/domain/rules/errors';
import type { Rules } from '@/config/rules.schema';
import type { Reservation, ServicePeriod, Table, TableZone, VenueKey } from '@/types/dining';
import { periodsFor, startTimes, tableMinutes } from './periods';
import { allocateTables, counterSeatsLeft, type Allocation } from './tables';

type DiningRules = Rules['dining'];

const VENUE_NAME: Record<VenueKey, string> = {
  restaurant: 'the Restaurant',
  pdr: 'Private Dining',
  teppanyaki: 'Teppanyaki',
};

export interface ValidateReservationInput {
  now: string;
  venue: VenueKey;
  start: string;
  partySize: number;
  zone?: TableZone;
  tables: readonly Table[];
  reservations: readonly Reservation[];
  depositFils: number;
  availableFils: number;
  dining: DiningRules;
  /** When re-validating an existing reservation (party-size change), ignore its own tables. */
  exceptId?: string;
}

export type ReservationCheck =
  | {
      ok: true;
      mode: 'instant' | 'request';
      period: ServicePeriod;
      end: string;
      allocation?: Allocation;
    }
  | RuleRejection;

export function validateReservation(input: ValidateReservationInput): ReservationCheck {
  const { venue, start, partySize, dining, now } = input;
  const rules = dining[venue];

  // 1 — party size.
  if (partySize < rules.partySize.min || partySize > rules.partySize.max) {
    return reject(
      'GUEST_LIMIT',
      `${VENUE_NAME[venue]} takes parties of ${rules.partySize.min}–${rules.partySize.max}.`,
      { min: rules.partySize.min, max: rules.partySize.max },
    );
  }
  // 2 — booking window and lead time.
  if (start > addDaysIso(now, dining.bookingWindowDays)) {
    return reject('WINDOW_NOT_OPEN', `Reservations open ${dining.bookingWindowDays} days ahead.`);
  }
  if (start < addHoursIso(now, rules.leadTimeHours) || start <= now) {
    return reject(
      'LEAD_TIME',
      rules.leadTimeHours > 0
        ? `${VENUE_NAME[venue]} needs ${rules.leadTimeHours}h notice.`
        : 'That time has passed.',
      { hours: rules.leadTimeHours },
    );
  }
  // 3 — a real start time in one of the venue's periods.
  const window = periodsFor(venue, dubaiDateKey(start), dining).find(
    (p) => p.start <= start && start < p.end,
  );
  if (!window || !startTimes(venue, window, partySize, dining).includes(start)) {
    return reject('OUTSIDE_HOURS', `${VENUE_NAME[venue]} doesn't seat at that time.`);
  }
  const end = addMinutesIso(start, tableMinutes(venue, partySize, dining));

  // 4 — large Restaurant parties go to the manager.
  if (venue === 'restaurant' && partySize >= dining.restaurant.requestModeMinPartySize) {
    return { ok: true, mode: 'request', period: window.period, end };
  }

  // 5 — a table (or counter seats).
  const allocation = allocateTables({
    tables: input.tables,
    reservations: input.reservations,
    venue,
    start,
    end,
    partySize,
    zone: input.zone,
    exceptId: input.exceptId,
  });
  if (!allocation) {
    if (venue === 'teppanyaki') {
      const counter = input.tables.find((t) => t.venue === 'teppanyaki');
      const left = counterSeatsLeft(
        counter?.seats ?? 0,
        input.reservations,
        start,
        end,
        input.exceptId,
      );
      return reject(
        'SLOT_FULL',
        left > 0
          ? `Only ${left} counter ${left === 1 ? 'seat' : 'seats'} left at this seating — split the party, or join the waitlist.`
          : 'This seating is full — try the other seating, or join the waitlist.',
        { seatsLeft: left },
      );
    }
    return reject('SLOT_FULL', 'No table free for that party at this time.');
  }

  // 6 — the deposit has to fit in what's available.
  if (input.depositFils > input.availableFils) {
    return reject('INSUFFICIENT_BALANCE', 'Your wallet needs a top-up to hold the deposit.', {
      depositFils: input.depositFils,
      shortfallFils: input.depositFils - input.availableFils,
    });
  }
  return { ok: true, mode: 'instant', period: window.period, end, allocation };
}
