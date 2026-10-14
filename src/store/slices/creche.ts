import type { CrecheState, StoreSlice } from '../types';

export const createCrecheSlice: StoreSlice<CrecheState> = () => ({
  crecheSessions: {},
  crecheBookings: {},
  bandAssignments: [],
});
