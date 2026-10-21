'use client';

/**
 * The booking's wallet panel (PRD §8.4 step 5): balance, what's available
 * (holds don't count), the deposit this booking will hold — and why, for
 * a repeat-no-show deposit — the Private Dining minimum spend, and the
 * inline top-up when the deposit doesn't fit.
 */
import { useState } from 'react';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { TopUpSheet } from '@/features/wallet/TopUpSheet';
import { useStore } from '@/store';
import { rules } from '@/config/rules';
import { useFmt, useT } from '@/i18n/hooks';
import { availableFils } from '@/domain/wallet/holds';
import { depositFor, repeatNoShowStatus } from '@/domain/dining/policy';
import type { VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';

export function WalletPanel({
  slot,
  venue,
  partySize,
}: {
  slot: DeviceSlotId;
  venue: VenueKey;
  partySize: number;
}) {
  const t = useT();
  const fmt = useFmt();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const wallet = useStore((s) => (resident ? s.wallets[resident.unitId] : undefined));
  const holds = useStore((s) => s.walletHolds);
  const reservations = useStore((s) => s.reservations);
  const now = useStore((s) => s.demo.clock.now);
  const [topUp, setTopUp] = useState(false);
  if (!resident) return null;

  const dining = rules.dining;
  const repeat = repeatNoShowStatus(
    Object.values(reservations).filter((r) => r.residentId === resident.id),
    now,
    dining,
  );
  const deposit = depositFor(venue, partySize, repeat.required, dining);
  const available = availableFils(wallet, Object.values(holds), resident.unitId);
  const short = deposit - available;

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-serif-display text-serif-section text-text-title">
          {t('resident.home.quick.wallet')}
        </span>
        <span className="text-body-3 text-text-muted">
          {t('dining.wallet.balance', {
            balance: fmt.aed(wallet?.balanceFils ?? 0),
            available: fmt.aed(available),
          })}
        </span>
      </div>
      {deposit > 0 ? (
        <p className="text-body-2 text-text-body">
          {t('dining.wallet.deposit', { amount: fmt.aed(deposit) })}
          {venue === 'teppanyaki' &&
            ` ${t('dining.wallet.setMenu', { amount: fmt.aed(dining.teppanyaki.pricePerPersonFils) })}`}
        </p>
      ) : (
        <p className="text-body-2 text-text-body">{t('dining.wallet.noDeposit')}</p>
      )}
      {venue === 'pdr' && (
        <p className="text-body-3 text-text-muted">
          {t('dining.wallet.minimumSpend', { amount: fmt.aed(dining.pdr.minimumSpendFils) })}
        </p>
      )}
      {repeat.required && venue === 'restaurant' && (
        <Banner style="warning">
          {t('dining.wallet.repeatNoShow', {
            noShows: repeat.noShows,
            count: repeat.remaining,
            amount: fmt.aed(dining.restaurant.noShow.depositRequiredFils),
          })}
        </Banner>
      )}
      {short > 0 &&
        (resident.walletRole === 'primary' ? (
          <>
            <Banner style="warning">
              {t('dining.wallet.topUpAtLeast', { amount: fmt.aed(short) })}
            </Banner>
            <Button variant="secondary" fullWidth onClick={() => setTopUp(true)}>
              {t('wallet.topUp')}
            </Button>
          </>
        ) : (
          <Banner style="warning">
            {t('dining.wallet.askPrimary', { amount: fmt.aed(short) })}
          </Banner>
        ))}
      <TopUpSheet
        open={topUp}
        onClose={() => setTopUp(false)}
        unitId={resident.unitId}
        actor={{ kind: 'resident', id: resident.id }}
        slot={slot}
      />
    </Card>
  );
}
