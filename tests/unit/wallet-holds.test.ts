import { describe, it, expect } from 'vitest';
import { rng, rngInt, rngPick } from '@/lib/random';
import {
  availableFils,
  forfeitHold,
  placeHold,
  planSettlement,
  reduceHold,
  releaseHold,
} from '@/domain/wallet/holds';
import type { Wallet, WalletHold } from '@/types/wallet';

const T = '2026-10-16T13:00:00.000Z';
const UNIT = 'W-PH02';
const ref = { type: 'reservation', id: 'r1' };

function hold(fils: number, state: WalletHold['state'] = 'active', id = 'h1'): WalletHold {
  return { id, createdAt: T, updatedAt: T, unitId: UNIT, fils, label: 'Deposit', ref, state };
}

describe('holds', () => {
  it('available is the balance less active holds only', () => {
    const wallet = { unitId: UNIT, balanceFils: 62000 };
    expect(availableFils(wallet, [hold(40000), hold(5000, 'released', 'h2')], UNIT)).toBe(22000);
  });

  it('refuses a hold bigger than what is available, reporting the shortfall', () => {
    const r = placeHold({ unitId: UNIT, balanceFils: 12000 }, [], {
      id: 'h',
      unitId: UNIT,
      fils: 40000,
      label: 'Deposit',
      ref,
      now: T,
    });
    expect(r).toEqual({ ok: false, shortfallFils: 28000, availableFils: 12000 });
  });

  it('release, reduce and forfeit move money the right way', () => {
    const wallet = { unitId: UNIT, balanceFils: 50000 };
    expect(releaseHold(hold(20000), T).hold.state).toBe('released');
    expect(reduceHold(hold(40000), 20000, T)).toMatchObject({
      hold: { fils: 20000 },
      entry: { kind: 'hold_release', fils: 20000 },
    });
    const f = forfeitHold(wallet, hold(20000), T);
    expect(f.wallet.balanceFils).toBe(30000);
    expect(f.hold.state).toBe('forfeited');
  });
});

describe('settlement plan', () => {
  const wallet = { unitId: UNIT, balanceFils: 212000 };

  it('applies the deposit and charges the rest to the wallet when it fits', () => {
    expect(
      planSettlement({
        totalFils: 152000,
        minimumSpendFils: 0,
        hold: hold(40000),
        wallet,
        holds: [hold(40000)],
        unitId: UNIT,
      }),
    ).toEqual({
      billFils: 152000,
      minimumSpendTopUpFils: 0,
      depositAppliedFils: 40000,
      remainderFils: 112000,
      method: 'wallet',
    });
  });

  it('falls back to the unit account when the wallet is short (PRD S5 with an AED 500 top-up)', () => {
    const short = { unitId: UNIT, balanceFils: 62000 };
    expect(
      planSettlement({
        totalFils: 152000,
        minimumSpendFils: 0,
        hold: hold(40000),
        wallet: short,
        holds: [hold(40000)],
        unitId: UNIT,
      }).method,
    ).toBe('unit_account');
  });

  it('adds a Private Dining minimum-spend top-up line', () => {
    const plan = planSettlement({
      totalFils: 120000,
      minimumSpendFils: 150000,
      hold: hold(50000),
      wallet,
      holds: [hold(50000)],
      unitId: UNIT,
    });
    expect(plan).toMatchObject({
      billFils: 150000,
      minimumSpendTopUpFils: 30000,
      depositAppliedFils: 50000,
      remainderFils: 100000,
    });
  });

  it('never applies more deposit than the bill', () => {
    const plan = planSettlement({
      totalFils: 30000,
      minimumSpendFils: 0,
      hold: hold(40000),
      wallet,
      holds: [hold(40000)],
      unitId: UNIT,
    });
    expect(plan).toMatchObject({ depositAppliedFils: 30000, remainderFils: 0 });
  });
});

/**
 * Property (TRD P8 exit criterion): over random sequences of top-ups,
 * holds, releases, reductions, forfeits and settlements — applied exactly
 * as the commands apply them — `available = balance − Σ active holds`
 * never drops below zero.
 */
describe('wallet invariant (property)', () => {
  it('available stays ≥ 0 across 400 random sequences of 40 operations', () => {
    for (let run = 0; run < 400; run += 1) {
      const r = rng('wallet-property', run);
      let wallet: Wallet = { unitId: UNIT, balanceFils: rngInt(r, 0, 50) * 1000 };
      let holds: WalletHold[] = [];
      let n = 0;
      const active = () => holds.filter((h) => h.state === 'active');
      const replace = (h: WalletHold) => (holds = holds.map((x) => (x.id === h.id ? h : x)));

      for (let step = 0; step < 40; step += 1) {
        const op = rngPick(r, [
          'topup',
          'hold',
          'hold',
          'release',
          'reduce',
          'forfeit',
          'settle',
        ] as const);
        const target = active().length ? rngPick(r, active()) : undefined;
        if (op === 'topup')
          wallet = { ...wallet, balanceFils: wallet.balanceFils + rngInt(r, 1, 20) * 1000 };
        if (op === 'hold') {
          const res = placeHold(wallet, holds, {
            id: `h${(n += 1)}`,
            unitId: UNIT,
            fils: rngInt(r, 1, 30) * 1000,
            label: 'Deposit',
            ref,
            now: T,
          });
          if (res.ok) holds.push(res.hold);
        }
        if (op === 'release' && target) replace(releaseHold(target, T).hold);
        if (op === 'reduce' && target)
          replace(reduceHold(target, Math.floor(target.fils / 2), T).hold);
        if (op === 'forfeit' && target) {
          const f = forfeitHold(wallet, target, T);
          wallet = f.wallet;
          replace(f.hold);
        }
        if (op === 'settle' && target) {
          const plan = planSettlement({
            totalFils: rngInt(r, 1, 60) * 1000,
            minimumSpendFils: rngPick(r, [0, 40000]),
            hold: target,
            wallet,
            holds,
            unitId: UNIT,
          });
          // As `dining.settle` does: capture the applied deposit; the wallet pays the rest only on 'wallet'.
          replace({ ...target, state: 'captured' });
          const paid =
            plan.depositAppliedFils + (plan.method === 'wallet' ? plan.remainderFils : 0);
          wallet = { ...wallet, balanceFils: wallet.balanceFils - paid };
        }
        expect(availableFils(wallet, holds, UNIT)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
