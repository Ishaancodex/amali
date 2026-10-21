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
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { forfeitsDeposit, isLateCancellation } from '@/domain/dining/policy';
import type { DeviceSlotId } from '@/types/demo';
import { Chip } from './Chip';

const STATE_TONE = {
  requested: 'warning',
  confirmed: 'success',
  seated: 'success',
  completed: 'info',
  no_show: 'danger',
  cancelled: 'info',
  late_cancelled: 'danger',
  declined: 'danger',
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
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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
        <TopBar title={t('dining.reservation')} onBack={pop} />
        <EmptyState icon={UtensilsCrossed} message={t('dining.notFound')} />
      </div>
    );
  }

  const late = isLateCancellation(r.venue, r.start, now, rules.dining);
  const keepsDeposit = late && forfeitsDeposit(r.venue) && hold?.state === 'active';
  const zone = r.tableIds.map((id) => tables[id]?.zone).find(Boolean);

  function run(result: { ok: boolean; error?: { code: string; message: string } }, done: string) {
    pushToast(slot, result.ok ? done : errorText(result.error), result.ok ? 'success' : 'error');
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t(`dining.venue.${r.venue}`)} onBack={pop} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6 [&>*]:shrink-0">
        <Card className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-title-l text-text-title">{fmt.dateTime(r.start)}</p>
            <Tag variant={STATE_TONE[r.state]}>{t(`dining.state.${r.state}`)}</Tag>
          </div>
          <p className="text-body-2 text-text-body">
            {t('dining.partyUntil', { count: r.partySize, time: fmt.time(r.end) })}
            {zone && zone !== 'counter' && zone !== 'private'
              ? ` · ${t(`dining.zone.${zone}`)}`
              : ''}
          </p>
          {r.seatingPref && (
            <p className="text-body-3 text-text-muted">
              {t('dining.seatingRequested', { zone: t(`dining.zone.${r.seatingPref}`) })}
              {zoneMissed ? ` ${t('dining.zoneMissed')}` : ''}
            </p>
          )}
          {(r.occasion || r.dietary.length > 0 || r.requests) && (
            <p className="text-body-3 text-text-muted">
              {[r.occasion, ...r.dietary, r.requests].filter(Boolean).join(' · ')}
            </p>
          )}
          {hold && (
            <p className="text-body-3 text-text-muted">
              {t('dining.depositState', {
                amount: fmt.aed(hold.fils),
                state: t(`dining.holdState.${hold.state}`),
              })}
            </p>
          )}
          {r.managerMessage && (
            <p className="text-body-3 text-text-muted">
              {t('dining.fromManager', { message: r.managerMessage })}
            </p>
          )}
        </Card>

        {r.bill && (
          <Card className="flex flex-col gap-1">
            <p className="text-label-1 text-text-title">{t('dining.tag.receipt')}</p>
            <p className="text-body-2 text-text-body">
              {t('dining.bill', { amount: fmt.aed(r.bill.totalFils) })}
            </p>
            {r.bill.minimumSpendTopUpFils && (
              <p className="text-body-2 text-text-body">
                {t('dining.minTopUp', { amount: fmt.aed(r.bill.minimumSpendTopUpFils) })}
              </p>
            )}
            {r.bill.depositAppliedFils && (
              <p className="text-body-2 text-text-body">
                {t('dining.depositApplied', { amount: fmt.aed(r.bill.depositAppliedFils) })}
              </p>
            )}
            <p className="text-label-2 text-text-title">
              {t(r.bill.method === 'wallet' ? 'dining.chargedWallet' : 'dining.chargedUnit', {
                amount: fmt.aed(r.bill.chargedFils),
              })}
            </p>
          </Card>
        )}

        {r.state === 'confirmed' && (
          <>
            {lateOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-2 text-text-body">{t('dining.about')}</span>
                {[10, 20, 30].map((m) => (
                  <Chip
                    key={m}
                    active={r.runningLateMinutes === m}
                    onClick={() => {
                      run(
                        dispatch('dining.runningLate', { reservationId: r.id, minutes: m }, actor),
                        t('dining.hostKnows'),
                      );
                      setLateOpen(false);
                    }}
                  >
                    {t('common.minutes', { count: m })}
                  </Chip>
                ))}
              </div>
            ) : (
              <Button variant="secondary" fullWidth onClick={() => setLateOpen(true)}>
                {r.runningLateMinutes
                  ? t('dining.runningLateUpdate', { minutes: r.runningLateMinutes })
                  : t('dining.runningLate')}
              </Button>
            )}
          </>
        )}
        {(r.state === 'confirmed' || r.state === 'requested') && (
          <>
            {keepsDeposit && (
              <Banner style="warning">
                {t('dining.lateCancelKeeps', {
                  hours: rules.dining[r.venue].lateCancellationHoursBefore,
                  amount: fmt.aed(hold.fils),
                })}
              </Banner>
            )}
            <Button
              variant="destructive"
              fullWidth
              onClick={() =>
                run(
                  dispatch('dining.cancel', { reservationId: r.id }, actor),
                  t('dining.cancelled'),
                )
              }
            >
              {t('dining.cancelReservation')}
            </Button>
            <p className="text-body-3 text-text-muted text-center">
              {t(forfeitsDeposit(r.venue) ? 'dining.policyForfeit' : 'dining.policyRepeat', {
                hours: rules.dining[r.venue].lateCancellationHoursBefore,
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
