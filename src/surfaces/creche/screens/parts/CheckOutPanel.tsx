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
import { fmtTime } from '@/lib/time';
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
      pushToast(slot, `Checked out${fee ? ` · AED ${fee / 100} to the wallet` : ''}.`, 'success');
    } else {
      setError(result.error.message);
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
    if (!result.ok) setError(result.error.message);
    else setError(undefined);
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-body-3 text-text-muted">
        In since {fmtTime(booking.checkIn?.at ?? now)} · session ends {fmtTime(session.end)}
      </p>
      {late > 0 && (
        <Banner style="urgent">
          Late pickup: {late} min · AED{' '}
          {lateFeeFils(session.end, now, graceMinutes, feePer15MinFils) / 100} late fee
        </Banner>
      )}
      {error && <Banner style="urgent">{error}</Banner>}

      {approval ? (
        approval.state === 'pending' ? (
          <Banner style="warning">
            Waiting for parent approval — {approval.collectorName}, requested{' '}
            {fmtTime(approval.requestedAt)}.
          </Banner>
        ) : approval.state === 'approved' ? (
          <>
            <Banner style="success">
              Parent approved a one-time pickup by {approval.collectorName} at{' '}
              {fmtTime(approval.decidedAt ?? now)}.
            </Banner>
            <Button fullWidth onClick={() => checkOut(false)}>
              Complete check-out
            </Button>
          </>
        ) : (
          <Banner style="urgent">
            The parent denied pickup by {approval.collectorName}. Keep {child.name.split(' ')[0]} in
            the room.
          </Banner>
        )
      ) : (
        <>
          <Button fullWidth disabled={!auth.ok} onClick={() => checkOut(true)}>
            {auth.ok ? `Check out with ${guardian?.name.split(' ')[0]}` : auth.message}
          </Button>
          {collectorOpen ? (
            <div className="flex flex-col gap-2">
              <Input
                label="Collector’s name"
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                placeholder="e.g. Joy Santos (nanny)"
              />
              <Button
                variant="secondary"
                fullWidth
                disabled={!collectorName.trim()}
                onClick={requestApproval}
              >
                Photograph and ask the parent
              </Button>
            </div>
          ) : (
            <Button variant="destructive" fullWidth onClick={() => setCollectorOpen(true)}>
              Unauthorised collector
            </Button>
          )}
        </>
      )}
    </section>
  );
}
