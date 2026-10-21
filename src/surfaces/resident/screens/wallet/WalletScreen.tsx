'use client';

/** Wallet (PRD §8.4): balance, top-up, ledger. */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Skeleton } from '@/ui/Skeleton';
import { BalanceChip } from '@/features/wallet/BalanceChip';
import { TopUpSheet } from '@/features/wallet/TopUpSheet';
import { Ledger } from '@/features/wallet/Ledger';
import { isLowBalance } from '@/domain/wallet/ledger';
import { activeHoldsFils } from '@/domain/wallet/holds';
import { useFmt, useT } from '@/i18n/hooks';
import { useStore } from '@/store';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';

export function WalletScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const { pop } = useNav(slot);
  const [sheetOpen, setSheetOpen] = useState(false);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const wallet = useStore((s) => (resident ? s.wallets[resident.unitId] : undefined));
  const ledgerRecord = useStore((s) => s.ledger);
  const holdsRecord = useStore((s) => s.walletHolds);
  const ledger = resident
    ? Object.values(ledgerRecord).filter((e) => e.unitId === resident.unitId)
    : [];

  const { status, data } = useSimulatedQuery(`wallet:${resident?.unitId}`, () => ({
    balanceFils: wallet?.balanceFils ?? 0,
    entries: ledger,
  }));

  if (!resident) return null;

  const canTopUp = resident.walletRole === 'primary';
  // Deposits on hold stay in the balance but can't be spent (PRD §8.4).
  const onHold = activeHoldsFils(Object.values(holdsRecord), resident.unitId);

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('resident.home.quick.wallet')} onBack={pop} />
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-3 px-4 py-6">
          <span className="text-body-2 text-text-muted">{t('wallet.balance')}</span>
          {status === 'loading' ? (
            <Skeleton className="h-9 w-32" />
          ) : (
            <BalanceChip balanceFils={data.balanceFils} />
          )}
          {onHold > 0 && (
            <p className="text-body-3 text-text-muted">
              {t('wallet.onHold', {
                held: fmt.aed(onHold),
                available: fmt.aed((wallet?.balanceFils ?? 0) - onHold),
              })}
            </p>
          )}
          {canTopUp ? (
            <Button variant="primary" onClick={() => setSheetOpen(true)}>
              {t('wallet.topUp')}
            </Button>
          ) : (
            <p className="text-body-3 text-text-muted">{t('wallet.primaryOnly')}</p>
          )}
        </div>

        {status === 'ready' && isLowBalance(data.balanceFils) && (
          <div className="px-4 pb-2">
            <Banner style="warning">{t('wallet.low')}</Banner>
          </div>
        )}

        <div className="px-4 pb-6">
          <h2 className="text-label-1 text-text-title mb-2">{t('resident.nav.activity')}</h2>
          {status === 'loading' ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : (
            <Ledger entries={data.entries} />
          )}
        </div>
      </div>

      <TopUpSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        unitId={resident.unitId}
        actor={{ kind: 'resident', id: resident.id }}
        slot={slot}
      />
    </div>
  );
}
