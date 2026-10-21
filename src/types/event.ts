/**
 * Events and attendance — Screening Room and Music Room (TRD §5.4).
 */
import type { BaseEntity, Charge, ISODateTime } from './common';
import type { HoursException } from './amenity';
import type { SeasonHours } from './programme';

export type EventVenue = 'screening' | 'music' | 'pool' | 'padel';
export type EventType = 'movie' | 'live_music' | 'workshop' | 'class' | 'clinic';
export type AgeRating = 'G' | 'PG' | 'PG-13' | '18+';
export type AttendeeCategory = 'resident' | 'household' | 'guest_adult' | 'guest_child';
export type EventLifecycle = 'draft' | 'scheduled' | 'published' | 'cancelled' | 'completed';

export interface ProgrammeEvent extends BaseEntity {
  title: string;
  venue: EventVenue;
  type: EventType;
  poster: string;
  description: string;
  ageRating: AgeRating;
  durationMins: number;
  pricing: Record<AttendeeCategory, number>; // fils
  recurrence?: string; // RRULE
  seasonId?: string;
  lifecycle: EventLifecycle;
  publishAt?: ISODateTime;
}

export type ShowtimeCapacityMode = 'seats' | 'headcount';
export type ShowtimeState = 'open' | 'full' | 'closed' | 'in_progress' | 'completed' | 'cancelled';

export interface Showtime extends BaseEntity {
  eventId: string;
  start: ISODateTime;
  end: ISODateTime;
  capacityMode: ShowtimeCapacityMode;
  capacity: number;
  blockedSeats: string[];
  /** Set when a programme series created it. */
  programmeId?: string;
  regOpens: ISODateTime;
  regCloses: ISODateTime;
  state: ShowtimeState;
}

export type AttendanceState = 'attended' | 'no_show';
export type AttendanceMode = 'live' | 'post';

export interface RsvpAttendee {
  id: string;
  name: string;
  category: AttendeeCategory;
  seat?: string;
  attendance?: AttendanceState;
  markedAt?: ISODateTime;
  markedBy?: string;
  mode?: AttendanceMode;
}

export type RsvpState = 'held' | 'confirmed' | 'cancelled' | 'late_cancelled';

export interface Rsvp extends BaseEntity {
  showtimeId: string;
  unitId: string;
  bookerId: string;
  attendees: RsvpAttendee[];
  charges: Charge[];
  state: RsvpState;
}

export interface Season extends BaseEntity {
  name: string;
  start: ISODateTime;
  end: ISODateTime;
  banner: string;
  hoursOverrides: HoursException[];
  /** Daily hours for the whole range (Ramadan: Pool 08:00–20:00) — materialised into per-date `exceptions`. */
  hours?: SeasonHours[];
  /** Year-view band colour token. */
  tone?: 'brand' | 'info' | 'success' | 'warning';
}
