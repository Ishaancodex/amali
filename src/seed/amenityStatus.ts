/**
 * Initial amenity status — everything opens "Open" (PRD §8.5 status
 * model). Real status changes (blackouts, maintenance, emergency closure)
 * come from ops commands in later phases; this is just the seed baseline
 * so Home's "Today at Amali" strip has something true to show.
 */
import type { StatusEntry, AmenityKey } from '@/types/amenity';
import { seededId, rng } from '@/lib/random';

const ALL_KEYS: AmenityKey[] = ['padel', 'screening', 'music', 'creche', 'dining', 'pool', 'gym'];

export function buildAmenityStatus(seed: string, now: string): StatusEntry[] {
  const r = rng(seed, 'amenityStatus');
  return ALL_KEYS.map((amenity) => ({
    id: seededId(r, 'status'),
    createdAt: now,
    updatedAt: now,
    amenity,
    status: 'open',
    from: now,
    setBy: 'system',
  }));
}
