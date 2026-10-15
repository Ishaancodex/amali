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
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { fmtDate, fmtTime, addMinutesIso } from '@/lib/time';
import { quotaCountingBookings, computeQuotaUsage } from '@/domain/booking/quota';
import { isCurrentlySuspended } from '@/domain/booking/strikes';
import type { DeviceSlotId } from '@/types/demo';

export function PadelStatusCard({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const resident = useStore((s) => s.residents[actorId]);
  const unit = useStore((s) => (resident ? s.units[resident.unitId] : undefined));
  const now = useStore((s) => s.demo.clock.now);
  const bookingsRecord = useStore((s) => s.bookings);
  const waitlistRecord = useStore((s) => s.waitlist);
  const suspensionsRecord = useStore((s) => s.suspensions);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);

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
      result.ok ? 'Booking cancelled.' : result.error.message,
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
      result.ok ? "You're checked in." : result.error.message,
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
      result.ok ? 'Booking confirmed from the waitlist.' : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suspension && (
        <Banner style="warning">Padel booking is suspended until {fmtDate(suspension.to)}.</Banner>
      )}

      <Card className="flex items-center justify-between">
        <span className="text-body-2 text-text-body">Quota this week</span>
        <span className="text-label-2 text-text-title tabular-nums">
          {usage.total} of {rules.padel.quota.maxBookings} used
        </span>
      </Card>

      {upcoming && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-label-2 text-text-title">
              {fmtDate(upcoming.start)} · {fmtTime(upcoming.start)}–{fmtTime(upcoming.end)}
            </span>
            <Tag variant={upcoming.state === 'checked_in' ? 'success' : 'brand'}>
              {upcoming.state === 'checked_in' ? 'Checked in' : 'Booked'}
            </Tag>
          </div>
          <div className="flex gap-2">
            {canCheckIn && (
              <Button variant="secondary" onClick={() => checkIn(upcoming.id)}>
                Check in
              </Button>
            )}
            {upcoming.state === 'confirmed' && (
              <Button variant="destructive" onClick={() => cancel(upcoming.id)}>
                Cancel
              </Button>
            )}
          </div>
        </Card>
      )}

      {myWaitlist.map((entry) => (
        <Card key={entry.id} className="flex items-center justify-between">
          <div>
            <p className="text-label-2 text-text-body">Waitlisted</p>
            <p className="text-body-3 text-text-muted">
              {entry.state === 'offered'
                ? 'Offer available — accept now'
                : `Position #${entry.position}`}
            </p>
          </div>
          {entry.state === 'offered' && (
            <Button onClick={() => acceptOffer(entry.id)}>Accept</Button>
          )}
        </Card>
      ))}
    </div>
  );
}
