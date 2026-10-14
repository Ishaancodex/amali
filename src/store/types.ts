/**
 * The combined `AppState` shape (TRD §16.3) and the `StoreSlice` helper type
 * every slice creator uses. Collections are normalized as `Record<id, T>`.
 */
import type { StateCreator } from 'zustand';
import type * as T from '@/types';
import type { Job } from '@/scheduler/queue';

export interface CommunityState {
  units: Record<string, T.Unit>;
  residents: Record<string, T.Resident>;
  children: Record<string, T.Child>;
  guardians: Record<string, T.Guardian>;
  staff: Record<string, T.Staff>;
  vendors: Record<string, T.Vendor>;
}

export interface AmenitiesState {
  amenities: Record<T.AmenityKey, T.Amenity>;
  amenityStatus: T.StatusEntry[];
  hours: T.WeeklyHours[];
  exceptions: Record<string, T.HoursException>;
  blackouts: Record<string, T.Blackout>;
}

export interface BookingsState {
  bookings: Record<string, T.Booking>;
  holds: Record<string, T.Hold>;
  waitlist: Record<string, T.WaitlistEntry>;
  strikes: Record<string, T.Strike>;
  suspensions: Record<string, T.Suspension>;
}

export interface EventsState {
  events: Record<string, T.ProgrammeEvent>;
  showtimes: Record<string, T.Showtime>;
  rsvps: Record<string, T.Rsvp>;
  seasons: Record<string, T.Season>;
}

export interface CrecheState {
  crecheSessions: Record<string, T.CrecheSession>;
  crecheBookings: Record<string, T.CrecheBooking>;
  bandAssignments: T.BandAssignment[];
}

export interface DiningState {
  tables: Record<string, T.Table>;
  reservations: Record<string, T.Reservation>;
}

export interface WalletState {
  wallets: Record<string, T.Wallet>; // keyed by unitId
  ledger: Record<string, T.LedgerEntry>;
}

export interface OpsState {
  checklistTemplates: Record<string, T.ChecklistTemplate>;
  checklistRuns: Record<string, T.ChecklistRun>;
  cleaningLogs: Record<string, T.CleaningLog>;
  waterReadings: Record<string, T.WaterReading>;
  shifts: Record<string, T.Shift>;
  incidents: Record<string, T.Incident>;
  workOrders: Record<string, T.WorkOrder>;
}

export interface CommsState {
  announcements: Record<string, T.Announcement>;
  deliveries: Record<string, T.Delivery>;
  waMessages: Record<string, T.WaMessage>;
  channelPosts: Record<string, T.ChannelPost>;
}

export interface NotificationsState {
  notifications: Record<string, T.Notification>;
}

export interface AuditState {
  auditLog: T.AuditEntry[];
}

export interface SchedulerState {
  /** Persisted mirror of the runtime `SchedulerEngine`'s job queue (TRD §8.1). */
  jobs: Record<string, Job>;
}

export interface DemoSliceState {
  demo: T.DemoState;
}

/**
 * Pure data shape — no actions. This is what `seed/buildSeed` returns and
 * what `store/selectors/*` read. Action methods live only on `RootStore`
 * (below), so a selector can never accidentally depend on a slice's own
 * setter.
 */
export type AppState = CommunityState &
  AmenitiesState &
  BookingsState &
  EventsState &
  CrecheState &
  DiningState &
  WalletState &
  OpsState &
  CommsState &
  NotificationsState &
  AuditState &
  SchedulerState &
  DemoSliceState;

/**
 * The full Zustand store type: data plus every slice's actions. Each slice
 * module augments this via declaration merging as it adds actions (only
 * `demo` has any in Phase P0 — see `slices/demo.ts`).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RootActions {}

export type RootStore = AppState & RootActions;

export type StoreSlice<Slice> = StateCreator<RootStore, [['zustand/immer', never]], [], Slice>;

/**
 * Every `AppState` key, in one place. `store/sync.ts` uses this to pick the
 * pure-data slice of `RootStore` before posting it over `BroadcastChannel`
 * (action methods can't survive structured clone). Kept as a `satisfies`
 * check so a typo here is a compile error; `tests/unit/store.test.ts`
 * checks the list is also *complete* against `buildSeed`'s output.
 */
export const APP_STATE_KEYS = [
  'units',
  'residents',
  'children',
  'guardians',
  'staff',
  'vendors',
  'amenities',
  'amenityStatus',
  'hours',
  'exceptions',
  'blackouts',
  'bookings',
  'holds',
  'waitlist',
  'strikes',
  'suspensions',
  'events',
  'showtimes',
  'rsvps',
  'seasons',
  'crecheSessions',
  'crecheBookings',
  'bandAssignments',
  'tables',
  'reservations',
  'wallets',
  'ledger',
  'checklistTemplates',
  'checklistRuns',
  'cleaningLogs',
  'waterReadings',
  'shifts',
  'incidents',
  'workOrders',
  'announcements',
  'deliveries',
  'waMessages',
  'channelPosts',
  'notifications',
  'auditLog',
  'jobs',
  'demo',
] as const satisfies readonly (keyof AppState)[];

export function pickAppState(state: RootStore): AppState {
  const picked = {} as AppState;
  for (const key of APP_STATE_KEYS) {
    (picked as unknown as Record<string, unknown>)[key] = state[key];
  }
  return picked;
}
