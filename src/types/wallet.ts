/**
 * Membership wallet, cross-amenity (TRD §5.6).
 */
import type { BaseEntity, ISODateTime } from './common';

export interface Wallet {
  unitId: string;
  balanceFils: number;
}

export type LedgerEntryKind =
  | 'topup'
  | 'charge'
  | 'hold'
  | 'hold_release'
  | 'refund'
  | 'fee'
  | 'forfeit';

export interface LedgerEntry extends BaseEntity {
  unitId: string;
  at: ISODateTime;
  kind: LedgerEntryKind;
  fils: number;
  label: string;
  ref?: { type: string; id: string };
  byResidentId?: string;
}
