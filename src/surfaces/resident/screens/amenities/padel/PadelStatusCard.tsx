'use client';

/**
 * Padel booking status for the resident (PRD §8.1 detail-screen flow):
 * quota meter, suspension banner, the resident's upcoming booking (with
 * cancel / self check-in), and any waitlist position.
 */
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { Ticket } from '@/ui/icons';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { addMinutesIso } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { quotaCountingBookings, computeQuotaUsage } from '@/domain/booking/quota';
import { isCurrentlySuspended } from '@/domain/booking/strikes';
import type { DeviceSlotId } from '@/types/demo';
import { Odometer } from '@/ui/Odometer';

export function PadelStatusCard({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const unit = useStore((s) => (resident ? s.units[resident.unitId] : undefined));
  const now = useStore((s) => s.demo.clock.now);
  const bookingsRecord = useStore((s) => s.bookings);
  const waitlistRecord = useStore((s) => s.waitlist);
  const suspensionsRecord = useStore((s) => s.suspensions);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const { push } = useNav(slot);

  if (!resident || !unit) return null;

  const unitBookings = Object.values(bookingsRecord).filter(
    (b) => b.amenity === 'padel' && b.unitId === unit.id,
  );
  const usage = computeQuotaUsage(quotaCountingBookings(unitBookings, now));

  const suspension = isCurrentlySuspended(
    Object.values(suspensionsRecord).filter(
      (s) => s.residentId === resident.id && s.amenity === 'padel',
    ),
    now,
  );

  const upcoming = Object.values(bookingsRecord)
    .filter(
      (b) =>
        b.bookerId === resident.id &&
        b.amenity === 'padel' &&
        (b.state === 'confirmed' || b.state === 'checked_in'),
    )
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  const myWaitlist = Object.values(waitlistRecord).filter(
    (w) => w.residentId === resident.id && (w.state === 'waiting' || w.state === 'offered'),
  );

  const checkInOpen = upcoming
    ? addMinutesIso(upcoming.start, -rules.padel.checkIn.opensMinutesBefore)
    : undefined;
  const checkInClose = upcoming
    ? addMinutesIso(upcoming.start, rules.padel.checkIn.closesMinutesAfter)
    : undefined;
  const canCheckIn = !!(
    upcoming?.state === 'confirmed' &&
    checkInOpen &&
    checkInClose &&
    now >= checkInOpen &&
    now <= checkInClose
  );

  function cancel(bookingId: string) {
    const result = dispatch(
      'booking.cancel',
      { bookingId },
      { kind: 'resident', id: resident!.id },
    );
    pushToast(
      slot,
      result.ok ? t('padel.toast.cancelled') : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  function checkIn(bookingId: string) {
    const result = dispatch(
      'booking.checkIn',
      { bookingId },
      { kind: 'resident', id: resident!.id },
    );
    pushToast(
      slot,
      result.ok ? t('padel.toast.checkedIn') : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  function acceptOffer(waitlistEntryId: string) {
    const result = dispatch(
      'waitlist.accept',
      { waitlistEntryId },
      { kind: 'resident', id: resident!.id },
    );
    pushToast(
      slot,
      result.ok ? t('padel.toast.fromWaitlist') : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suspension && (
        <Banner style="warning">
          {t('padel.suspendedUntil', { date: fmt.date(suspension.to) })}
        </Banner>
      )}

      <Card className="flex items-center justify-between">
        <span className="text-body-2 text-text-body">{t('padel.quotaThisWeek')}</span>
        <span className="font-serif-display text-serif-section text-text-title tabular-nums">
          {t('padel.quotaUsed', { used: usage.total, max: rules.padel.quota.maxBookings })}
        </span>
      </Card>

      {upcoming && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-serif-display text-serif-section text-text-title">
              {fmt.date(upcoming.start)} · {fmt.time(upcoming.start)}–{fmt.time(upcoming.end)}
            </span>
            <Tag variant={upcoming.state === 'checked_in' ? 'success' : 'brand'}>
              {upcoming.state === 'checked_in' ? t('padel.checkedIn') : t('padel.booked')}
            </Tag>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => push('padel-pass', { id: upcoming.id })}>
              <Ticket className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t('resident.home.pass')}
            </Button>
            {canCheckIn && (
              <Button variant="secondary" onClick={() => checkIn(upcoming.id)}>
                {t('padel.checkIn')}
              </Button>
            )}
            {upcoming.state === 'confirmed' && (
              <Button variant="destructive" onClick={() => cancel(upcoming.id)}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {myWaitlist.map((entry) => (
        <Card key={entry.id} className="flex items-center justify-between">
          <div>
            <p className="text-label-2 text-text-body">{t('padel.waitlisted')}</p>
            <p className="text-body-3 text-text-muted">
              {entry.state === 'offered' ? (
                t('padel.offerAvailable')
              ) : (
                // M12: the waitlist position rolls as people ahead drop out.
                <>
                  {t('padel.positionLabel')} <Odometer value={`#${entry.position}`} />
                </>
              )}
            </p>
          </div>
          {entry.state === 'offered' && (
            <Button onClick={() => acceptOffer(entry.id)}>{t('padel.accept')}</Button>
          )}
        </Card>
      ))}
    </div>
  );
}
