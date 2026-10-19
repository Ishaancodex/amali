'use client';

/**
 * Settle bill (PRD §8.4): enter the amount and preview exactly what
 * `dining.settle` will do — the deposit applied, a Private Dining
 * minimum-spend top-up line, and the rest to the wallet, or to the unit
 * account when the wallet can't cover it — then "Charge to wallet".
 */
import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { aedToFils, fmtAed } from '@/lib/money';
import { planSettlement } from '@/domain/wallet/holds';
import type { Reservation } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';

export function SettlePanel({
  slot,
  reservation: r,
}: {
  slot: DeviceSlotId;
  reservation: Reservation;
}) {
  const wallet = useStore((s) => s.wallets[r.unitId]);
  const holdsRecord = useStore((s) => s.walletHolds);
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const role = useStore((s) => s.staff[actorId]?.role);
  const pushToast = useUiStore((s) => s.pushToast);
  const [amount, setAmount] = useState('');

  const totalFils = aedToFils(Number(amount) || 0);
  const hold = r.depositHoldId ? holdsRecord[r.depositHoldId] : undefined;
  const plan =
    totalFils > 0 && r.unitId
      ? planSettlement({
          totalFils,
          minimumSpendFils: r.venue === 'pdr' ? rules.dining.pdr.minimumSpendFils : 0,
          hold,
          wallet,
          holds: Object.values(holdsRecord),
          unitId: r.unitId,
        })
      : undefined;

  function settle() {
    const result = dispatch(
      'dining.settle',
      { reservationId: r.id, totalFils },
      { kind: 'staff', id: actorId, role },
    );
    pushToast(
      slot,
      result.ok ? 'Settled — receipt sent.' : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="border-border-card rounded-card flex flex-col gap-2 border-[0.5px] p-3">
      <Input
        label="Bill (AED)"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
        placeholder="e.g. 1520"
      />
      {plan && (
        <ul className="text-body-3 text-text-body flex flex-col gap-0.5">
          <li>Bill {fmtAed(totalFils)}</li>
          {plan.minimumSpendTopUpFils > 0 && (
            <li>Minimum spend top-up {fmtAed(plan.minimumSpendTopUpFils)}</li>
          )}
          {plan.depositAppliedFils > 0 && (
            <li>Deposit applied −{fmtAed(plan.depositAppliedFils)}</li>
          )}
          <li className={plan.method === 'wallet' ? 'text-label-2' : 'text-label-2 text-warning'}>
            {fmtAed(plan.remainderFils)}{' '}
            {plan.method === 'wallet'
              ? 'to the wallet'
              : '— wallet short, to the unit account (invoice)'}
          </li>
        </ul>
      )}
      {!r.unitId && (
        <p className="text-body-3 text-text-muted">Walk-in guest — recorded as paid at the till.</p>
      )}
      <Button fullWidth disabled={totalFils <= 0} onClick={settle}>
        {plan?.method === 'unit_account' ? 'Charge to unit account' : 'Charge to wallet'}
      </Button>
    </div>
  );
}
