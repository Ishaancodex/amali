/**
 * Padel bookings, holds, waitlists and penalties (TRD §5.3).
 */
import type { BaseEntity, Charge, ISODateTime } from './common';
import type { AmenityKey } from './amenity';

export type BookingState =
  | 'held'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'late_cancelled'
  | 'no_show'
  | 'cancelled_by_ops';

export type BookingSource = 'resident' | 'agent' | 'waitlist' | 'priority_rebook';

export interface BookingPlayer {
  residentId?: string;
  guestName?: string;
  guestPhone?: string;
}

export interface BookingHistoryEntry {
  state: BookingState;
  at: ISODateTime;
  by: string;
  note?: string;
}

export interface Booking extends BaseEntity {
  amenity: 'padel';
  unitId: string;
  bookerId: string;
  start: ISODateTime;
  end: ISODateTime;
  players: BookingPlayer[];
  charges: Charge[];
  state: BookingState;
  history: BookingHistoryEntry[];
  source: BookingSource;
  countsTowardQuota: boolean;
}

export interface Hold extends BaseEntity {
  resourceKey: string; // 'padel:2026-10-15T13:00:00.000Z'
  byResidentId: string;
  expiresAt: ISODateTime;
}

export type WaitlistState = 'waiting' | 'offered' | 'accepted' | 'expired' | 'withdrawn' | 'skipped';
export type WaitlistOfferMode = 'sequential' | 'open_release';

export interface WaitlistOffer {
  sentAt: ISODateTime;
  expiresAt: ISODateTime;
  mode: WaitlistOfferMode;
}

export interface WaitlistEntry extends BaseEntity {
  resourceKey: string;
  residentId: string;
  partySize: number;
  position: number;
  state: WaitlistState;
  offer?: WaitlistOffer;
}

export type StrikeKind = 'no_show' | 'late_cancel';

export interface Strike extends BaseEntity {
  residentId: string;
  unitId: string;
  amenity: AmenityKey;
  kind: StrikeKind;
  at: ISODateTime;
  bookingId: string;
}

export interface Suspension extends BaseEntity {
  residentId: string;
  amenity: AmenityKey;
  from: ISODateTime;
  to: ISODateTime;
  liftedBy?: string;
}
