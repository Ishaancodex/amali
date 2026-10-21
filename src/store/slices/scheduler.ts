import type { SchedulerState, StoreSlice } from '../types';

export const createSchedulerSlice: StoreSlice<SchedulerState> = () => ({
  jobs: {},
  reportSchedules: {},
});
