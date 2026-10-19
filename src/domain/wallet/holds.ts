/**
 * Deposits as wallet holds (PRD §8.4: "Holds show as 'On hold' and don't
 * count toward the available balance"). Pure: every function takes the
 * wallet and its holds and returns the next wallet, the hold change and
 * the ledger entry to append — the invariant they keep is
 *
 *   available = balance − Σ active holds ≥ 0
 *
 * A hold leaves the balance alone. Releasing it returns it to available;
 * capturing it applies it to a bill (the balance pays); forfeiting takes
 * it (the balance pays, nothing is bought).
 */
import type { ISODateTime } from '@/types/common';
import type { LedgerEntry, Wallet, WalletHold } from '@/types/wallet';

export type LedgerDraft = Omit<LedgerEntry, 'id'>;

export function activeHoldsFils(holds: readonly WalletHold[], unitId: string): number {
  return holds
    .filter((h) => h.unitId === unitId && h.state === 'active')
    .reduce((sum, h) => sum + h.fils, 0);
}

export function availableFils(
  wallet: Wallet | undefined,
  holds: readonly WalletHold[],
  unitId: string,
): number {
  return (wallet?.balanceFils ?? 0) - activeHoldsFils(holds, unitId);
}

function entry(
  unitId: string,
  now: ISODateTime,
  kind: LedgerEntry['kind'],
  fils: number,
  label: string,
  ref: { type: string; id: string } | undefined,
  byResidentId?: string,
): LedgerDraft {
  return { createdAt: now, updatedAt: now, unitId, at: now, kind, fils, label, ref, byResidentId };
}

export type PlaceHoldResult =
  | { ok: true; hold: WalletHold; entry: LedgerDraft }
  | { ok: false; shortfallFils: number; availableFils: number };

/** Places a hold only if it fits in what's available — the invariant can't be broken here. */
export function placeHold(
  wallet: Wallet | undefined,
  holds: readonly WalletHold[],
  input: {
    id: string;
    unitId: string;
    fils: number;
    label: string;
    ref: { type: string; id: string };
    now: ISODateTime;
    byResidentId?: string;
  },
): PlaceHoldResult {
  const available = availableFils(wallet, holds, input.unitId);
  if (input.fils > available) {
    return { ok: false, shortfallFils: input.fils - available, availableFils: available };
  }
  const hold: WalletHold = {
    id: input.id,
    createdAt: input.now,
    updatedAt: input.now,
    unitId: input.unitId,
    fils: input.fils,
    label: input.label,
    ref: input.ref,
    state: 'active',
  };
  return {
    ok: true,
    hold,
    entry: entry(
      input.unitId,
      input.now,
      'hold',
      -input.fils,
      input.label,
      input.ref,
      input.byResidentId,
    ),
  };
}

/** Returns a hold to available (cancelled in time, party size cut, request declined). */
export function releaseHold(hold: WalletHold, now: ISODateTime, label = `${hold.label} released`) {
  return {
    hold: { ...hold, state: 'released' as const, updatedAt: now },
    entry: entry(hold.unitId, now, 'hold_release', hold.fils, label, hold.ref),
  };
}

/** Shrinks an active hold (a party-size cut more than 24h ahead refunds the difference). */
export function reduceHold(hold: WalletHold, newFils: number, now: ISODateTime) {
  const diff = hold.fils - newFils;
  return {
    hold: { ...hold, fils: newFils, updatedAt: now },
    entry: entry(hold.unitId, now, 'hold_release', diff, `${hold.label} reduced`, hold.ref),
  };
}

/** Takes the held amount — a Teppanyaki/PDR no-show or late cancellation. */
export function forfeitHold(wallet: Wallet | undefined, hold: WalletHold, now: ISODateTime) {
  const current = wallet ?? { unitId: hold.unitId, balanceFils: 0 };
  return {
    wallet: { ...current, balanceFils: current.balanceFils - hold.fils },
    hold: { ...hold, state: 'forfeited' as const, updatedAt: now },
    entry: entry(hold.unitId, now, 'forfeit', -hold.fils, `${hold.label} forfeited`, hold.ref),
  };
}

export interface SettlementInput {
  totalFils: number;
  /** PDR minimum spend; 0 when none. */
  minimumSpendFils: number;
  hold?: WalletHold;
  wallet: Wallet | undefined;
  /** All the unit's holds, the deposit hold included. */
  holds: readonly WalletHold[];
  unitId: string;
}

export interface SettlementPlan {
  /** The bill, plus a minimum-spend top-up line when below the minimum. */
  billFils: number;
  minimumSpendTopUpFils: number;
  depositAppliedFils: number;
  /** What's left after the deposit. */
  remainderFils: number;
  method: 'wallet' | 'unit_account';
}

/**
 * Settle a bill (PRD §8.4 "Settle bill"): the deposit is applied, the rest
 * goes to the wallet — or, when what's available can't cover it, to the
 * unit account as an invoice (PRD edge case: the balance dropped since
 * booking). The deposit is captured either way: it was the resident's.
 */
export function planSettlement(input: SettlementInput): SettlementPlan {
  const minimumSpendTopUpFils = Math.max(0, input.minimumSpendFils - input.totalFils);
  const billFils = input.totalFils + minimumSpendTopUpFils;
  const deposit = input.hold?.state === 'active' ? input.hold.fils : 0;
  const depositAppliedFils = Math.min(deposit, billFils);
  const remainderFils = billFils - depositAppliedFils;
  // Available once this deposit stops being held and is applied: balance − other holds − deposit.
  const otherHolds = activeHoldsFils(input.holds, input.unitId) - deposit;
  const afterDeposit = (input.wallet?.balanceFils ?? 0) - otherHolds - depositAppliedFils;
  return {
    billFils,
    minimumSpendTopUpFils,
    depositAppliedFils,
    remainderFils,
    method: remainderFils <= afterDeposit ? 'wallet' : 'unit_account',
  };
}
