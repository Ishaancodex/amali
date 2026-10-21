'use client';

/**
 * Wallet top-up sheet (PRD §8.4: "preset amounts AED 500/1,000/2,000";
 * §11: "Wallet top-up fails (mock 'card declined' toggle). Inline error,
 * nothing is charged, and a retry is offered.").
 */
import { useState } from 'react';
import { Sheet } from '@/ui/Sheet';
import { Button } from '@/ui/Button';
import { CreditCard, CircleAlert } from '@/ui/icons';
import { aedToFils } from '@/lib/money';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import type { DeviceSlotId } from '@/types/demo';
import type { Actor } from '@/types/common';

const PRESETS_AED = [500, 1000, 2000];

export function TopUpSheet({
  open,
  onClose,
  unitId,
  actor,
  slot,
}: {
  open: boolean;
  onClose: () => void;
  unitId: string;
  actor: Actor;
  slot: DeviceSlotId;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const [amountAed, setAmountAed] = useState(PRESETS_AED[0] ?? 500);
  const [simulateDecline, setSimulateDecline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);

  function handleConfirm() {
    setLoading(true);
    setError(null);
    // A brief simulated processing delay makes the mock card feel real.
    setTimeout(() => {
      const result = dispatch(
        'wallet.topUp',
        { unitId, amountFils: aedToFils(amountAed), simulateDecline },
        actor,
      );
      setLoading(false);
      if (result.ok) {
        pushToast(slot, t('wallet.toppedUp', { amount: fmt.aed(aedToFils(amountAed)) }), 'success');
        onClose();
      } else {
        setError(errorText(result.error));
      }
    }, 500);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('wallet.topUpTitle')}>
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-3 gap-2">
          {PRESETS_AED.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountAed(preset)}
              aria-pressed={amountAed === preset}
              className={`rounded-input text-label-2 border px-3 py-3 transition-colors ${
                amountAed === preset
                  ? 'border-brand bg-brand-tint text-brand'
                  : 'border-border-card text-text-body'
              }`}
            >
              {fmt.aed(aedToFils(preset))}
            </button>
          ))}
        </div>

        <div className="rounded-input border-border-card text-body-2 text-text-muted flex items-center gap-2 border px-3 py-2.5">
          <CreditCard className="text-brand h-4 w-4" strokeWidth={1.5} />
          {t('wallet.mockCard')}
        </div>

        <label className="text-body-3 text-text-muted flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulateDecline}
            onChange={(e) => setSimulateDecline(e.target.checked)}
            className="accent-brand h-4 w-4"
          />
          {t('wallet.simulateDecline')}
        </label>

        {error && (
          <div className="rounded-input bg-danger/10 text-body-3 text-danger flex items-center gap-2 px-3 py-2.5">
            <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {error}
          </div>
        )}

        <Button variant="primary" fullWidth loading={loading} onClick={handleConfirm}>
          {t('wallet.topUpAmount', { amount: fmt.aed(aedToFils(amountAed)) })}
        </Button>
      </div>
    </Sheet>
  );
}
