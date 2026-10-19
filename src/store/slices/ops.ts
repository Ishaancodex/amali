import type { OpsState, StoreSlice } from '../types';

export const createOpsSlice: StoreSlice<OpsState> = () => ({
  checklistTemplates: {},
  checklistRuns: {},
  cleaningLogs: {},
  waterReadings: {},
  shifts: {},
  incidents: {},
  workOrders: {},
  occupancy: {},
});
