'use client';

/** Wallet (PRD §8.4): balance, top-up, ledger. */
import { useState } from 'react';
import { ScreenShell } from '@/ui/ScreenShell';
import { SectionHeading } from '@/ui/SectionHeading';
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
    <>
      <ScreenShell
        eyebrow={t('wallet.balance')}
        title={t('resident.home.quick.wallet')}
        onBack={pop}
        image="/stock/wallet.jpg"
        headerExtra={
          <div className="mt-4 flex flex-col items-start gap-3">
            {status === 'loading' ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <BalanceChip balanceFils={data.balanceFils} large />
            )}
            {onHold > 0 && (
              <p className="text-body-3 text-on-ember-muted">
                {t('wallet.onHold', {
                  held: fmt.aed(onHold),
                  available: fmt.aed((wallet?.balanceFils ?? 0) - onHold),
                })}
              </p>
            )}
          </div>
        }
      >
        {canTopUp ? (
          <Button variant="primary" fullWidth onClick={() => setSheetOpen(true)}>
            {t('wallet.topUp')}
          </Button>
        ) : (
          <p className="text-body-3 text-text-muted">{t('wallet.primaryOnly')}</p>
        )}

        {status === 'ready' && isLowBalance(data.balanceFils) && (
          <Banner style="warning">{t('wallet.low')}</Banner>
        )}

        <section>
          <SectionHeading title={t('resident.nav.activity')} />
          {status === 'loading' ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="rounded-tile h-14" />
              ))}
            </div>
          ) : (
            <Ledger entries={data.entries} />
          )}
        </section>
      </ScreenShell>

      <TopUpSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        unitId={resident.unitId}
        actor={{ kind: 'resident', id: resident.id }}
        slot={slot}
      />
    </>
  );
}
