import type { BookingsState, StoreSlice } from '../types';

export const createBookingsSlice: StoreSlice<BookingsState> = () => ({
  bookings: {},
  holds: {},
  waitlist: {},
  strikes: {},
  suspensions: {},
});
