/**
 * Table allocation (PRD §8.4): the smallest free table that seats the
 * party, in the requested zone where possible ("Requested", not
 * guaranteed), else two adjacent combinable tables. Teppanyaki is one
 * shared counter — it's seats, not tables. Pure.
 */
import { rangesOverlap } from '@/lib/time';
import type { Reservation, Table, TableZone, VenueKey } from '@/types/dining';

/** Reservations that hold their tables (or counter seats). */
export function holdsTable(r: Reservation): boolean {
  return r.state === 'confirmed' || r.state === 'seated';
}

export function overlapping(
  reservations: readonly Reservation[],
  venue: VenueKey,
  start: string,
  end: string,
  exceptId?: string,
): Reservation[] {
  return reservations.filter(
    (r) =>
      r.venue === venue &&
      r.id !== exceptId &&
      holdsTable(r) &&
      rangesOverlap(r.start, r.end, start, end),
  );
}

export function counterSeatsLeft(
  counterSeats: number,
  reservations: readonly Reservation[],
  start: string,
  end: string,
  exceptId?: string,
): number {
  const used = overlapping(reservations, 'teppanyaki', start, end, exceptId).reduce(
    (sum, r) => sum + r.partySize,
    0,
  );
  return Math.max(0, counterSeats - used);
}

export interface Allocation {
  tableIds: string[];
  /** False when a seating preference was asked for but couldn't be met. */
  zoneHonoured: boolean;
}

export function allocateTables(input: {
  tables: readonly Table[];
  reservations: readonly Reservation[];
  venue: VenueKey;
  start: string;
  end: string;
  partySize: number;
  zone?: TableZone;
  exceptId?: string;
}): Allocation | undefined {
  const venueTables = input.tables.filter((t) => t.venue === input.venue);
  if (input.venue === 'teppanyaki') {
    const counter = venueTables[0];
    if (!counter) return undefined;
    const left = counterSeatsLeft(
      counter.seats,
      input.reservations,
      input.start,
      input.end,
      input.exceptId,
    );
    return left >= input.partySize ? { tableIds: [counter.id], zoneHonoured: true } : undefined;
  }

  const busy = new Set(
    overlapping(input.reservations, input.venue, input.start, input.end, input.exceptId).flatMap(
      (r) => r.tableIds,
    ),
  );
  const free = venueTables.filter((t) => !busy.has(t.id));
  const fits = (t: Table) => t.seats >= input.partySize;
  const bySize = (a: Table, b: Table) => a.seats - b.seats || a.id.localeCompare(b.id);
  const inZone = (t: Table) => !input.zone || t.zone === input.zone;

  const single = free.filter(fits).sort(bySize);
  const preferred = single.find(inZone);
  if (preferred) return { tableIds: [preferred.id], zoneHonoured: true };

  // Combine two adjacent tables before giving up on the preferred zone.
  const pairs = combinations(free).filter(([a, b]) => a.seats + b.seats >= input.partySize);
  pairs.sort((x, y) => x[0].seats + x[1].seats - (y[0].seats + y[1].seats));
  const preferredPair = pairs.find(([a, b]) => inZone(a) && inZone(b));
  if (preferredPair)
    return { tableIds: [preferredPair[0].id, preferredPair[1].id], zoneHonoured: true };

  if (single[0]) return { tableIds: [single[0].id], zoneHonoured: !input.zone };
  if (pairs[0]) return { tableIds: [pairs[0][0].id, pairs[0][1].id], zoneHonoured: !input.zone };
  return undefined;
}

function combinations(free: readonly Table[]): [Table, Table][] {
  const ids = new Set(free.map((t) => t.id));
  const out: [Table, Table][] = [];
  for (const a of free) {
    for (const bId of a.combinableWith) {
      const b = free.find((t) => t.id === bId);
      if (b && ids.has(bId) && a.id < bId) out.push([a, b]);
    }
  }
  return out;
}

/**
 * Share of the venue still free at a time (Restaurant: seats; Teppanyaki:
 * counter seats; PDR: the room) — a chip is "Limited" below 25%.
 */
export function freeFraction(
  tables: readonly Table[],
  reservations: readonly Reservation[],
  venue: VenueKey,
  start: string,
  end: string,
): number {
  const venueTables = tables.filter((t) => t.venue === venue);
  const total = venueTables.reduce((s, t) => s + t.seats, 0);
  if (total === 0) return 0;
  if (venue === 'teppanyaki') {
    return counterSeatsLeft(venueTables[0]?.seats ?? 0, reservations, start, end) / total;
  }
  const busy = new Set(overlapping(reservations, venue, start, end).flatMap((r) => r.tableIds));
  const free = venueTables.filter((t) => !busy.has(t.id)).reduce((s, t) => s + t.seats, 0);
  return free / total;
}
