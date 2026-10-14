/**
 * The seven amenities (PRD §2.2, §3.3, §5.8). Images are mapped to
 * `/amenities/<key>.jpg` by `scripts/map-amenity-images.ts` ahead of time.
 */
import type { Amenity, AmenityKey } from '@/types/amenity';
import { rules } from '@/config/rules';

const LOCATIONS: Record<AmenityKey, string> = {
  padel: 'Podium roof',
  screening: 'Amenity Deck, Level 6',
  music: 'Amenity Deck, Level 6',
  creche: 'Level 2',
  dining: 'Ground floor, canal side',
  pool: 'Amenity Deck, Level 6',
  gym: 'Level 33, West Tower',
};

const NAMES: Record<AmenityKey, string> = {
  padel: 'Padel Tennis Court',
  screening: 'Screening Room',
  music: 'Music Room',
  creche: "Creche and Kids' Playroom",
  dining: 'Restaurant, Private Dining and Teppanyaki',
  pool: 'Adult Pool',
  gym: 'Sky Gym',
};

export function buildAmenities(): Record<AmenityKey, Amenity> {
  const keys: AmenityKey[] = ['padel', 'screening', 'music', 'creche', 'dining', 'pool', 'gym'];

  const entries = keys.map<[AmenityKey, Amenity]>((key) => [
    key,
    {
      key,
      name: NAMES[key],
      image: `/amenities/${key}.jpg`,
      location: LOCATIONS[key],
      bookingModel:
        key === 'padel'
          ? 'slot'
          : key === 'screening' || key === 'music'
            ? 'event'
            : key === 'creche'
              ? 'session'
              : key === 'dining'
                ? 'reservation'
                : 'none',
      capacity:
        key === 'padel'
          ? rules.padel.courts
          : key === 'screening'
            ? rules.screening.capacity
            : key === 'music'
              ? rules.music.capacity
              : key === 'creche'
                ? rules.creche.roomCapacityAbsolute
                : key === 'dining'
                  ? rules.dining.restaurant.totalCovers
                  : key === 'pool'
                    ? rules.pool.capacity
                    : rules.gym.capacity,
      ...(key === 'pool' ? { ageMin: rules.pool.minAge } : {}),
    },
  ]);

  return Object.fromEntries(entries) as Record<AmenityKey, Amenity>;
}
