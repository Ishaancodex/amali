'use client';

/**
 * The reservation (PRD §8.4 step 6): what's booked, the deposit on hold,
 * a "Running late?" button that tells the host, Cancel with the policy
 * spelled out — and, once settled, the receipt.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { EmptyState } from '@/ui/EmptyState';
import { UtensilsCrossed } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { fmtAed } from '@/lib/money';
import { fmtDateTime, fmtTime } from '@/lib/time';
import { forfeitsDeposit, isLateCancellation } from '@/domain/dining/policy';
import type { DeviceSlotId } from '@/types/demo';
import { Chip } from './Chip';

const VENUE = { restaurant: 'Restaurant', pdr: 'Private Dining', teppanyaki: 'Teppanyaki' };
const STATE = {
  requested: ['Awaiting the manager', 'warning'],
  confirmed: ['Confirmed', 'success'],
  seated: ['Seated', 'success'],
  completed: ['Completed', 'info'],
  no_show: ['No-show', 'danger'],
  cancelled: ['Cancelled', 'info'],
  late_cancelled: ['Cancelled late', 'danger'],
  declined: ['Declined', 'danger'],
} as const;

export function ReservationDetailScreen({
  slot,
  reservationId,
  zoneMissed,
}: {
  slot: DeviceSlotId;
  reservationId: string;
  zoneMissed?: boolean;
}) {
  const { pop } = useNav(slot);
  const r = useStore((s) => s.reservations[reservationId]);
  const hold = useStore((s) => (r?.depositHoldId ? s.walletHolds[r.depositHoldId] : undefined));
  const tables = useStore((s) => s.tables);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const [lateOpen, setLateOpen] = useState(false);
  const actor = { kind: 'resident' as const, id: actorId };

  if (!r) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title="Reservation" onBack={pop} />
        <EmptyState icon={UtensilsCrossed} message="Reservation not found." />
      </div>
    );
  }

  const late = isLateCancellation(r.venue, r.start, now, rules.dining);
  const keepsDeposit = late && forfeitsDeposit(r.venue) && hold?.state === 'active';
  const zone = r.tableIds.map((t) => tables[t]?.zone).find(Boolean);

  function run(result: { ok: boolean; error?: { message: string } }, done: string) {
    pushToast(
      slot,
      result.ok ? done : (result.error?.message ?? ''),
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={VENUE[r.venue]} onBack={pop} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6 [&>*]:shrink-0">
        <Card className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-title-l text-text-title">{fmtDateTime(r.start)}</p>
            <Tag variant={STATE[r.state][1]}>{STATE[r.state][0]}</Tag>
          </div>
          <p className="text-body-2 text-text-body">
            {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'} · until {fmtTime(r.end)}
            {zone && zone !== 'counter' && zone !== 'private'
              ? ` · ${zone === 'canal' ? 'canal view' : zone}`
              : ''}
          </p>
          {r.seatingPref && (
            <p className="text-body-3 text-text-muted">
              Seating requested: {r.seatingPref}{' '}
              {zoneMissed ? '(not available — we’ve seated you nearby)' : ''}
            </p>
          )}
          {(r.occasion || r.dietary.length > 0 || r.requests) && (
            <p className="text-body-3 text-text-muted">
              {[r.occasion, ...r.dietary, r.requests].filter(Boolean).join(' · ')}
            </p>
          )}
          {hold && (
            <p className="text-body-3 text-text-muted">
              Deposit {fmtAed(hold.fils)} · {hold.state === 'active' ? 'on hold' : hold.state}
            </p>
          )}
          {r.managerMessage && (
            <p className="text-body-3 text-text-muted">From the manager: “{r.managerMessage}”</p>
          )}
        </Card>

        {r.bill && (
          <Card className="flex flex-col gap-1">
            <p className="text-label-1 text-text-title">Receipt</p>
            <p className="text-body-2 text-text-body">Bill {fmtAed(r.bill.totalFils)}</p>
            {r.bill.minimumSpendTopUpFils && (
              <p className="text-body-2 text-text-body">
                Minimum spend top-up {fmtAed(r.bill.minimumSpendTopUpFils)}
              </p>
            )}
            {r.bill.depositAppliedFils && (
              <p className="text-body-2 text-text-body">
                Deposit applied −{fmtAed(r.bill.depositAppliedFils)}
              </p>
            )}
            <p className="text-label-2 text-text-title">
              {fmtAed(r.bill.chargedFils)}{' '}
              {r.bill.method === 'wallet' ? 'from your wallet' : 'invoiced to your unit account'}
            </p>
          </Card>
        )}

        {r.state === 'confirmed' && (
          <>
            {lateOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-2 text-text-body">About</span>
                {[10, 20, 30].map((m) => (
                  <Chip
                    key={m}
                    active={r.runningLateMinutes === m}
                    onClick={() => {
                      run(
                        dispatch('dining.runningLate', { reservationId: r.id, minutes: m }, actor),
                        'The host knows.',
                      );
                      setLateOpen(false);
                    }}
                  >
                    {m} min
                  </Chip>
                ))}
              </div>
            ) : (
              <Button variant="secondary" fullWidth onClick={() => setLateOpen(true)}>
                {r.runningLateMinutes
                  ? `Running ~${r.runningLateMinutes} min late — update`
                  : 'Running late?'}
              </Button>
            )}
          </>
        )}
        {(r.state === 'confirmed' || r.state === 'requested') && (
          <>
            {keepsDeposit && (
              <Banner style="warning">
                Cancelling within {rules.dining[r.venue].lateCancellationHoursBefore}h keeps the{' '}
                {fmtAed(hold.fils)} deposit.
              </Banner>
            )}
            <Button
              variant="destructive"
              fullWidth
              onClick={() =>
                run(dispatch('dining.cancel', { reservationId: r.id }, actor), 'Cancelled.')
              }
            >
              Cancel reservation
            </Button>
            <p className="text-body-3 text-text-muted text-center">
              Free cancellation up to {rules.dining[r.venue].lateCancellationHoursBefore}h before.
              No-shows:{' '}
              {forfeitsDeposit(r.venue)
                ? 'the deposit is kept'
                : 'repeat no-shows need a deposit next time'}
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
