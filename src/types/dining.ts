/**
 * Dining — venues, tables and reservations (TRD §5.6). Wallet types live in
 * `types/wallet.ts`.
 */
import type { BaseEntity, ISODateTime } from './common';

export type VenueKey = 'restaurant' | 'pdr' | 'teppanyaki';
export type ServicePeriod = 'breakfast' | 'lunch' | 'dinner' | 'iftar';
export type TableZone = 'indoor' | 'terrace' | 'canal' | 'private' | 'counter';

export interface Table extends BaseEntity {
  venue: VenueKey;
  seats: number;
  zone: TableZone;
  x: number;
  y: number;
  combinableWith: string[];
}

export type ReservationMode = 'instant' | 'request';
export type ReservationState =
  | 'requested'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'late_cancelled'
  | 'declined';

export interface ReservationBill {
  totalFils: number;
  settledAt: ISODateTime;
  method: 'wallet' | 'unit_account';
}

export interface Reservation extends BaseEntity {
  venue: VenueKey;
  residentId: string;
  unitId: string;
  start: ISODateTime;
  end: ISODateTime;
  period: ServicePeriod;
  partySize: number;
  seatingPref?: TableZone;
  occasion?: string;
  dietary: string[];
  requests?: string;
  highChair?: boolean;
  tableIds: string[];
  mode: ReservationMode;
  depositHoldId?: string;
  state: ReservationState;
  bill?: ReservationBill;
}
