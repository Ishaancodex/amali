import type { EventsState, StoreSlice } from '../types';

export const createEventsSlice: StoreSlice<EventsState> = () => ({
  events: {},
  showtimes: {},
  rsvps: {},
  seasons: {},
  programme: {},
});
