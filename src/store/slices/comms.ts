import type { CommsState, StoreSlice } from '../types';

export const createCommsSlice: StoreSlice<CommsState> = () => ({
  announcements: {},
  deliveries: {},
  waMessages: {},
  channelPosts: {},
});
