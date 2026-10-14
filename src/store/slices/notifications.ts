import type { NotificationsState, StoreSlice } from '../types';

export const createNotificationsSlice: StoreSlice<NotificationsState> = () => ({
  notifications: {},
});
