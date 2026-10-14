import type { CommunityState, StoreSlice } from '../types';

export const createCommunitySlice: StoreSlice<CommunityState> = () => ({
  units: {},
  residents: {},
  children: {},
  guardians: {},
  staff: {},
  vendors: {},
});
