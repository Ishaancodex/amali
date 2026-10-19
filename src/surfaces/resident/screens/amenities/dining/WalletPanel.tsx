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
import { fmtAed } from '@/lib/money';
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
        <span className="text-label-2 text-text-title">Wallet</span>
        <span className="text-body-3 text-text-muted">
          Balance {fmtAed(wallet?.balanceFils ?? 0)} · available {fmtAed(available)}
        </span>
      </div>
      {deposit > 0 ? (
        <p className="text-body-2 text-text-body">
          Deposit {fmtAed(deposit)} held now, applied to your bill.
          {venue === 'teppanyaki' &&
            ` Set menu ${fmtAed(dining.teppanyaki.pricePerPersonFils)} per person.`}
        </p>
      ) : (
        <p className="text-body-2 text-text-body">No deposit needed.</p>
      )}
      {venue === 'pdr' && (
        <p className="text-body-3 text-text-muted">
          Minimum spend {fmtAed(dining.pdr.minimumSpendFils)} — any shortfall is charged as a top-up
          line.
        </p>
      )}
      {repeat.required && venue === 'restaurant' && (
        <Banner style="warning">
          After {repeat.noShows} no-shows, your next {repeat.remaining} Restaurant{' '}
          {repeat.remaining === 1 ? 'reservation needs' : 'reservations need'} a{' '}
          {fmtAed(dining.restaurant.noShow.depositRequiredFils)} per person deposit.
        </Banner>
      )}
      {short > 0 &&
        (resident.walletRole === 'primary' ? (
          <>
            <Banner style="warning">Top up at least {fmtAed(short)} to hold the deposit.</Banner>
            <Button variant="secondary" fullWidth onClick={() => setTopUp(true)}>
              Top up
            </Button>
          </>
        ) : (
          <Banner style="warning">
            {fmtAed(short)} short — ask your unit’s primary resident to top up.
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
