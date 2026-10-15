import { describe, it, expect, beforeAll } from 'vitest';
import { applyTopUp } from '@/domain/wallet/ledger';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import { buildSeed } from '@/seed';
import { PERSONA_IDS, UNIT_IDS } from '@/seed/personaIds';

describe('domain/wallet/ledger — applyTopUp', () => {
  it('adds the amount to an existing wallet', () => {
    const result = applyTopUp(
      { unitId: 'U-1', balanceFils: 10000 },
      { unitId: 'U-1', amountFils: 50000, byResidentId: 'res_1', now: '2026-10-14T13:30:00.000Z' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wallet.balanceFils).toBe(60000);
      expect(result.entry.kind).toBe('topup');
      expect(result.entry.fils).toBe(50000);
    }
  });

  it('creates a wallet from zero when none exists yet', () => {
    const result = applyTopUp(undefined, {
      unitId: 'U-2',
      amountFils: 100000,
      byResidentId: 'res_1',
      now: '2026-10-14T13:30:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.wallet.balanceFils).toBe(100000);
  });

  it('declines without charging when simulateDecline is set', () => {
    const result = applyTopUp(
      { unitId: 'U-1', balanceFils: 10000 },
      {
        unitId: 'U-1',
        amountFils: 50000,
        byResidentId: 'res_1',
        now: '2026-10-14T13:30:00.000Z',
        simulateDecline: true,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CARD_DECLINED');
  });
});

describe('store/commands/wallet — dispatch("wallet.topUp")', () => {
  beforeAll(() => {
    useStore.setState(buildSeed('amali-2026', '2026-10-14T13:30:00.000Z'));
  });

  it('increases the balance and writes a ledger entry', () => {
    const before = useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils ?? 0;
    const result = useStore
      .getState()
      .dispatch(
        'wallet.topUp',
        { unitId: UNIT_IDS.layla, amountFils: 50000 },
        { kind: 'resident', id: PERSONA_IDS.layla },
      );

    expect(result.ok).toBe(true);
    const after = useStore.getState().wallets[UNIT_IDS.layla]?.balanceFils;
    expect(after).toBe(before + 50000);

    const entries = Object.values(useStore.getState().ledger).filter(
      (e) => e.unitId === UNIT_IDS.layla,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('topup');
    expect(entries[0]?.fils).toBe(50000);
  });

  it('writes an audit log entry', () => {
    const before = useStore.getState().auditLog.length;
    useStore
      .getState()
      .dispatch(
        'wallet.topUp',
        { unitId: UNIT_IDS.sofia, amountFils: 100000 },
        { kind: 'resident', id: PERSONA_IDS.sofia },
      );
    expect(useStore.getState().auditLog.length).toBe(before + 1);
  });

  it('a declined top-up changes nothing', () => {
    const before = useStore.getState().wallets[UNIT_IDS.ahmed]?.balanceFils ?? 0;
    const result = useStore
      .getState()
      .dispatch(
        'wallet.topUp',
        { unitId: UNIT_IDS.ahmed, amountFils: 50000, simulateDecline: true },
        { kind: 'resident', id: PERSONA_IDS.ahmed },
      );
    expect(result.ok).toBe(false);
    expect(useStore.getState().wallets[UNIT_IDS.ahmed]?.balanceFils ?? 0).toBe(before);
  });
});
