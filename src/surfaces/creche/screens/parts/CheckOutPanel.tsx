'use client';

/**
 * Check-out (PRD §8.3 step 5): an authorised guardian collects directly;
 * anyone else is an "Unauthorised collector" — the parent gets an approval
 * request (app + WhatsApp) and this panel shows its live status until a
 * decision lands. Fees due are previewed before the tap.
 */
import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Input } from '@/ui/Input';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { guardianAuthorisation } from '@/domain/creche/guardians';
import { lateFeeFils, lateMinutes } from '@/domain/creche/fees';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { CrecheBooking } from '@/types/creche';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../../useCrecheStaff';

export function CheckOutPanel({
  slot,
  booking,
  guardianId,
}: {
  slot: DeviceSlotId;
  booking: CrecheBooking;
  guardianId: string;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { actor } = useCrecheStaff(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const child = useStore((s) => s.children[booking.childId]);
  const guardian = useStore((s) => s.guardians[guardianId]);
  const session = useStore((s) => s.crecheSessions[booking.sessionId]);
  const now = useStore((s) => s.demo.clock.now);
  const [collectorOpen, setCollectorOpen] = useState(false);
  const [collectorName, setCollectorName] = useState('');
  const [error, setError] = useState<string | undefined>();

  if (!child || !session) return null;

  const auth = guardianAuthorisation(guardian, child, now);
  const approval = booking.pendingApproval;
  const { graceMinutes, feePer15MinFils } = rules.creche.latePickup;
  const late = lateMinutes(session.end, now, graceMinutes);

  function checkOut(withGuardian: boolean) {
    if (!actor) return;
    const result = dispatch(
      'creche.checkOut',
      { bookingId: booking.id, guardianId: withGuardian ? guardianId : undefined },
      actor,
    );
    if (result.ok) {
      const fee = (result.value.feeFils ?? 0) + (result.value.lateFeeFils ?? 0);
      pushToast(
        slot,
        fee ? t('creche.checkedOutFee', { amount: fmt.aed(fee) }) : t('creche.checkedOut'),
        'success',
      );
    } else {
      setError(errorText(result.error));
    }
  }

  function requestApproval() {
    if (!actor) return;
    const initials = collectorName
      .trim()
      .split(/\s+/)
      .map((p) => p[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const result = dispatch(
      'creche.requestCollectorApproval',
      { bookingId: booking.id, collectorName, collectorPhoto: initials },
      actor,
    );
    if (!result.ok) setError(errorText(result.error));
    else setError(undefined);
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-body-3 text-text-muted">
        {t('creche.inSince', {
          since: fmt.time(booking.checkIn?.at ?? now),
          end: fmt.time(session.end),
        })}
      </p>
      {late > 0 && (
        <Banner style="urgent">
          {t('creche.latePickupFee', {
            minutes: late,
            amount: fmt.aed(lateFeeFils(session.end, now, graceMinutes, feePer15MinFils)),
          })}
        </Banner>
      )}
      {error && <Banner style="urgent">{error}</Banner>}

      {approval ? (
        approval.state === 'pending' ? (
          <Banner style="warning">
            {t('creche.waitingApproval', {
              name: approval.collectorName,
              time: fmt.time(approval.requestedAt),
            })}
          </Banner>
        ) : approval.state === 'approved' ? (
          <>
            <Banner style="success">
              {t('creche.parentApproved', {
                name: approval.collectorName,
                time: fmt.time(approval.decidedAt ?? now),
              })}
            </Banner>
            <Button fullWidth onClick={() => checkOut(false)}>
              {t('creche.completeCheckOut')}
            </Button>
          </>
        ) : (
          <Banner style="urgent">
            {t('creche.parentDenied', {
              name: approval.collectorName,
              child: child.name.split(' ')[0],
            })}
          </Banner>
        )
      ) : (
        <>
          <Button fullWidth disabled={!auth.ok} onClick={() => checkOut(true)}>
            {auth.ok
              ? t('creche.checkOutWith', { name: guardian?.name.split(' ')[0] })
              : t(`creche.auth.${auth.reason}`)}
          </Button>
          {collectorOpen ? (
            <div className="flex flex-col gap-2">
              <Input
                label={t('creche.collectorName')}
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                placeholder={t('creche.collectorHint')}
              />
              <Button
                variant="secondary"
                fullWidth
                disabled={!collectorName.trim()}
                onClick={requestApproval}
              >
                {t('creche.askParent')}
              </Button>
            </div>
          ) : (
            <Button variant="destructive" fullWidth onClick={() => setCollectorOpen(true)}>
              {t('creche.unauthorised')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
