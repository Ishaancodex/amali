/**
 * Membership wallet, cross-amenity (TRD §5.6).
 */
import type { BaseEntity, ISODateTime } from './common';

export interface Wallet {
  unitId: string;
  balanceFils: number;
}

export type LedgerEntryKind =
  'topup' | 'charge' | 'hold' | 'hold_release' | 'refund' | 'fee' | 'forfeit';

export interface LedgerEntry extends BaseEntity {
  unitId: string;
  at: ISODateTime;
  kind: LedgerEntryKind;
  fils: number;
  label: string;
  ref?: { type: string; id: string };
  byResidentId?: string;
}

/**
 * Money set aside from a wallet (PRD §8.4 deposits): it stays in the
 * balance but not in what's available — `available = balance − Σ active
 * holds`. A hold ends released (back to available), captured (applied to a
 * bill) or forfeited (taken, e.g. a Teppanyaki no-show).
 */
export type WalletHoldState = 'active' | 'released' | 'captured' | 'forfeited';

export interface WalletHold extends BaseEntity {
  unitId: string;
  fils: number;
  label: string;
  ref: { type: string; id: string };
  state: WalletHoldState;
}
