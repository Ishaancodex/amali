/**
 * The F&B tablet's current service (PRD §6.4: venue × service period):
 * today's period windows for the venue, the selected one, and its
 * reservations. Derived in the component body from raw store records (the
 * P2 selector footgun — never return fresh arrays from `useStore`).
 */
import { useStore } from '@/store';
import { rules } from '@/config/rules';
import { dubaiDateKey } from '@/lib/time';
import { periodsFor } from '@/domain/dining/periods';
import type { ServicePeriod, VenueKey } from '@/types/dining';

export function useService(venue: VenueKey, period: ServicePeriod | undefined) {
  const reservationsRecord = useStore((s) => s.reservations);
  const tablesRecord = useStore((s) => s.tables);
  const now = useStore((s) => s.demo.clock.now);

  const dateKey = dubaiDateKey(now);
  const windows = periodsFor(venue, dateKey, rules.dining);
  const current =
    windows.find((w) => w.start <= now && now < w.end) ??
    windows.find((w) => w.start > now) ??
    windows.at(-1)!;
  const window = windows.find((w) => w.period === period) ?? current;
  const tables = Object.values(tablesRecord)
    .filter((t) => t.venue === venue)
    .sort(
      (a, b) =>
        a.zone.localeCompare(b.zone) ||
        a.seats - b.seats ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  const all = Object.values(reservationsRecord);
  const inService = all
    .filter((r) => r.venue === venue && r.start >= window.start && r.start < window.end)
    .sort((a, b) => a.start.localeCompare(b.start));

  return { now, dateKey, windows, window, tables, all, inService };
}

/** PRD §8.4 edge case: a high-severity allergy note shows a red icon on every view of the booking. */
export function hasAllergy(dietary: readonly string[]): boolean {
  return dietary.some((d) => d.toLowerCase().includes('allerg'));
}
