/**
 * Amenities, hours and availability (TRD §5.2).
 */
import type { BaseEntity, ISODateTime } from './common';

export type AmenityKey = 'padel' | 'screening' | 'music' | 'creche' | 'dining' | 'pool' | 'gym';
export type AmenityStatus = 'open' | 'limited' | 'closed' | 'maintenance' | 'emergency';
export type BookingModel = 'slot' | 'event' | 'session' | 'reservation' | 'none';

export interface Amenity {
  key: AmenityKey;
  name: string;
  image: string;
  location: string;
  bookingModel: BookingModel;
  capacity: number;
  ageMin?: number;
}

/** History kept for audit and reports — one open-ended entry per status change. */
export interface StatusEntry extends BaseEntity {
  amenity: AmenityKey;
  status: AmenityStatus;
  reason?: string;
  from: ISODateTime;
  to?: ISODateTime;
  workOrderId?: string;
  setBy: string;
}

export interface WeeklyHours {
  amenity: AmenityKey;
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string; // 'HH:mm'
  close: string;
}

export interface HoursException {
  id: string;
  amenity: AmenityKey;
  date: string; // DateKey
  open?: string;
  close?: string;
  closed?: boolean;
  label: string;
  seasonId?: string;
}

export type BlackoutHandling = 'cancel_priority_rebook' | 'auto_move';
export type BlackoutSource = 'maintenance' | 'programme';

export interface Blackout extends BaseEntity {
  amenity: AmenityKey;
  start: ISODateTime;
  end: ISODateTime;
  reason: string;
  recurrence?: string; // RRULE
  source: BlackoutSource;
  handling: BlackoutHandling;
  workOrderId?: string;
  createdBy: string;
}
