import type { DiningState, StoreSlice } from '../types';

export const createDiningSlice: StoreSlice<DiningState> = () => ({
  tables: {},
  reservations: {},
});
