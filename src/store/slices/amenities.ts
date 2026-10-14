import type { AmenitiesState, StoreSlice } from '../types';
import type { Amenity, AmenityKey } from '@/types';

export const createAmenitiesSlice: StoreSlice<AmenitiesState> = () => ({
  // Populated by seed/amenities.ts (buildSeed) — empty until the store is hydrated.
  amenities: {} as Record<AmenityKey, Amenity>,
  amenityStatus: [],
  hours: [],
  exceptions: {},
  blackouts: {},
});
