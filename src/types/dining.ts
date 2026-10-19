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
  /** PDR only: the shortfall to the minimum spend, charged as its own line. */
  minimumSpendTopUpFils?: number;
  depositAppliedFils?: number;
  /** What was charged after the deposit — to the wallet, or to the unit account when the wallet was short. */
  chargedFils: number;
  /** Set when the wallet couldn't cover it and it went to the unit account (PRD §8.4 edge case). */
  flagged?: string;
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
  accessibility?: string;
  /** Host-side extras (PRD §8.4 F&B view). */
  notes?: string;
  walkIn?: boolean;
  /** Set by the +30 min job; the host then confirms the no-show. */
  noShowFlaggedAt?: ISODateTime;
  billRequestedAt?: ISODateTime;
  seatedAt?: ISODateTime;
  /** "Running late?" — minutes the resident told the host. */
  runningLateMinutes?: number;
  /** The decline/approve message for a large-party request. */
  managerMessage?: string;
}
