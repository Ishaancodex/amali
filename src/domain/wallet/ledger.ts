/**
 * Wallet top-up (PRD §8.4 "Membership wallet", §11 "Wallet top-up fails").
 * Pure domain logic — no React, no store (TRD layering rule).
 */
import type { Wallet, LedgerEntry } from '@/types/wallet';
import type { ISODateTime } from '@/types/common';

export interface TopUpInput {
  unitId: string;
  amountFils: number;
  byResidentId: string;
  now: ISODateTime;
  /** Demo-only: simulates a declined card (PRD §11). */
  simulateDecline?: boolean;
}

export type TopUpResult =
  | { ok: true; wallet: Wallet; entry: Omit<LedgerEntry, 'id'> }
  | { ok: false; code: 'CARD_DECLINED'; message: string };

export function applyTopUp(wallet: Wallet | undefined, input: TopUpInput): TopUpResult {
  if (input.simulateDecline) {
    return { ok: false, code: 'CARD_DECLINED', message: 'Card declined. Nothing was charged.' };
  }

  const current = wallet ?? { unitId: input.unitId, balanceFils: 0 };
  return {
    ok: true,
    wallet: { ...current, balanceFils: current.balanceFils + input.amountFils },
    entry: {
      createdAt: input.now,
      updatedAt: input.now,
      unitId: input.unitId,
      at: input.now,
      kind: 'topup',
      fils: input.amountFils,
      label: 'Wallet top-up',
      byResidentId: input.byResidentId,
    },
  };
}

export interface ChargeInput {
  unitId: string;
  amountFils: number;
  label: string;
  byResidentId?: string;
  ref?: LedgerEntry['ref'];
  now: ISODateTime;
}

/** Debits the wallet (PRD §8.1 guest fees, charged on confirm). `fils` is stored negative. */
export function applyCharge(
  wallet: Wallet | undefined,
  input: ChargeInput,
): { wallet: Wallet; entry: Omit<LedgerEntry, 'id'> } {
  const current = wallet ?? { unitId: input.unitId, balanceFils: 0 };
  return {
    wallet: { ...current, balanceFils: current.balanceFils - input.amountFils },
    entry: {
      createdAt: input.now,
      updatedAt: input.now,
      unitId: input.unitId,
      at: input.now,
      kind: 'charge',
      fils: -input.amountFils,
      label: input.label,
      byResidentId: input.byResidentId,
      ref: input.ref,
    },
  };
}

/** Credits the wallet back (PRD §8.1: on-time cancellation refunds the guest fee in full). */
export function applyRefund(
  wallet: Wallet | undefined,
  input: ChargeInput,
): { wallet: Wallet; entry: Omit<LedgerEntry, 'id'> } {
  const current = wallet ?? { unitId: input.unitId, balanceFils: 0 };
  return {
    wallet: { ...current, balanceFils: current.balanceFils + input.amountFils },
    entry: {
      createdAt: input.now,
      updatedAt: input.now,
      unitId: input.unitId,
      at: input.now,
      kind: 'refund',
      fils: input.amountFils,
      label: input.label,
      byResidentId: input.byResidentId,
      ref: input.ref,
    },
  };
}

/** PRD §8.4: "Low-balance warning below AED 200." */
export const LOW_BALANCE_THRESHOLD_FILS = 20000;

export function isLowBalance(balanceFils: number): boolean {
  return balanceFils < LOW_BALANCE_THRESHOLD_FILS;
}
