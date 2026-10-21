/**
 * 90 days of deterministic history (PRD §8.10 "Seed history", TRD P10):
 * padel bookings (weekday 18:00–21:00 and weekend 08:00–11:00 peaks, ~9%
 * no-shows, on-time and late cancellations, waitlist offers), past events
 * (~14% no-shows), Restaurant reservations (~6% no-shows) with settled
 * bills, work orders for SLA compliance, daily checklist runs, a few
 * announcements with their deliveries, the charges behind the revenue
 * KPI as ledger entries, and a 3-day pool maintenance whose dip shows in
 * the occupancy model. Only generated residents take part — the personas'
 * own wallets and histories stay as the scenarios expect.
 *
 * Pool / gym / creche occupancy isn't stored: `domain/reports/occupancy.ts`
 * models it from the same rules (and this maintenance window).
 */
import { rng, rngInt } from '@/lib/random';
import { addDaysIso, dubaiDateKey, dubaiDateTimeToIso, dubaiWeekday } from '@/lib/time';
import type { AppState } from '@/store/types';
import type { LedgerEntry } from '@/types/wallet';
import { UNIT_IDS } from '../personaIds';
import { quota, H, ANNOUNCEMENT_EVERY_DAYS } from './shared';
import { padelDay, dinnersDay, eventDay } from './bookings';
import { checklistDay, announcementDay, workOrderDay } from './ops';

/** Days ago the 3-day pool maintenance started (PRD: "a visible dip during a past 3-day pool maintenance"). */
export const POOL_MAINTENANCE_DAYS_AGO = 40;

export function buildHistory(state: AppState, seed: string, now: string): void {
  quota.padel = quota.events = quota.restaurant = 0;
  const r = rng(seed, 'history');
  const personaUnits = new Set<string>(Object.values(UNIT_IDS));
  const people = Object.values(state.residents)
    .filter((p) => (p.type === 'owner' || p.type === 'tenant') && !personaUnits.has(p.unitId))
    .sort((a, b) => a.id.localeCompare(b.id));
  const pick = () => people[rngInt(r, 0, people.length - 1)]!;
  const ledger = (e: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'>, id: string) => {
    state.ledger[id] = { id, createdAt: e.at, updatedAt: e.at, ...e };
  };

  for (let d = H.days; d >= 1; d -= 1) {
    const dayIso = addDaysIso(now, -d);
    const dateKey = dubaiDateKey(dayIso);
    const weekday = dubaiWeekday(dayIso);
    padelDay(state, r, dateKey, weekday, d, pick, ledger);
    if (d > 7) dinnersDay(state, r, dateKey, d, pick, ledger);
    if (weekday === 5 || weekday === 6) eventDay(state, r, dateKey, d, pick, ledger);
    checklistDay(state, dateKey, d);
    if (d % ANNOUNCEMENT_EVERY_DAYS === 0)
      announcementDay(
        state,
        r,
        dateKey,
        d,
        people.map((p) => p.id),
      );
    if (d % 3 === 0) workOrderDay(state, r, dateKey, d);
  }

  // The past 3-day pool maintenance (the dip in pool occupancy).
  const from = dubaiDateTimeToIso(
    dubaiDateKey(addDaysIso(now, -POOL_MAINTENANCE_DAYS_AGO)),
    '06:00',
  );
  state.amenityStatus.push({
    id: 'status_hist_pool_maintenance',
    createdAt: from,
    updatedAt: from,
    amenity: 'pool',
    status: 'maintenance',
    reason: 'Filtration system overhaul',
    from,
    to: addDaysIso(from, 3),
    setBy: 'staff_victor',
  });
}
