'use client';

/** One child's live Kids' Club status for the parent, with the pickup-approval decision when one is waiting. */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { Banner } from '@/ui/Banner';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { lateMinutes } from '@/domain/creche/fees';
import { fmtDate, fmtTime, minutesBetween } from '@/lib/time';
import type { Child, CrecheBooking } from '@/types/creche';
import type { DeviceSlotId } from '@/types/demo';

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ChildLiveCard({
  slot,
  child,
  booking,
  roomSummary,
}: {
  slot: DeviceSlotId;
  child: Child;
  booking: CrecheBooking;
  roomSummary: string;
}) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const session = useStore((s) => s.crecheSessions[booking.sessionId]);
  const staff = useStore((s) => s.staff);
  const now = useStore((s) => s.demo.clock.now);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  if (!session) return null;

  const first = child.name.split(' ')[0];
  const inRoom = booking.state === 'checked_in';
  const approval = booking.pendingApproval;
  const activity = booking.activity?.at(-1);
  const late = inRoom ? lateMinutes(session.end, now, rules.creche.latePickup.graceMinutes) : 0;

  function run(result: { ok: boolean; error?: { message: string } }, done: string) {
    pushToast(
      slot,
      result.ok ? done : (result.error?.message ?? ''),
      result.ok ? 'success' : 'error',
    );
  }
  const actor = { kind: 'resident' as const, id: actorId };

  const timeline = [
    { at: booking.createdAt, label: booking.state === 'waitlisted' ? 'Waitlisted' : 'Booked' },
    ...(booking.checkIn
      ? [
          {
            at: booking.checkIn.at,
            label: `Checked in by ${staff[booking.checkIn.by]?.name ?? 'staff'}`,
          },
        ]
      : []),
    ...(booking.activity ?? []).map((a) => ({ at: a.at, label: a.label })),
  ];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <ChildAvatar initials={child.photo} />
        <div className="min-w-0 flex-1">
          <p className="text-label-1 text-text-title">{first}</p>
          <p className="text-body-3 text-text-muted">
            {inRoom
              ? `In the Playroom · Checked in ${fmtTime(booking.checkIn!.at)} · ${duration(minutesBetween(booking.checkIn!.at, now))}`
              : `${fmtDate(session.start)} · ${fmtTime(session.start)}–${fmtTime(session.end)}`}
          </p>
        </div>
        <Tag variant={inRoom ? 'success' : booking.state === 'waitlisted' ? 'warning' : 'brand'}>
          {inRoom ? 'In' : booking.state === 'waitlisted' ? 'Waitlist' : 'Booked'}
        </Tag>
      </div>

      {inRoom && (
        <div className="bg-brand-tint rounded-card flex items-center justify-between px-3 py-2">
          <span className="text-label-2 text-brand">
            {activity ? activity.label : 'Settling in'}
          </span>
          <span className="text-body-3 text-text-muted">{roomSummary}</span>
        </div>
      )}

      {late > 0 && (
        <Banner style="urgent">
          Pickup was due {fmtTime(session.end)}. Late fees are now applying.
        </Banner>
      )}

      {approval?.state === 'pending' && (
        <div className="flex flex-col gap-2">
          <Banner style="warning">
            {approval.collectorName} ({approval.collectorPhoto}) is here to collect {first}. Allow a
            one-time pickup?
          </Banner>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() =>
                run(
                  dispatch(
                    'creche.decideApproval',
                    { bookingId: booking.id, approvalId: approval.id, decision: 'denied' },
                    actor,
                  ),
                  'Pickup denied.',
                )
              }
            >
              Deny
            </Button>
            <Button
              fullWidth
              onClick={() =>
                run(
                  dispatch(
                    'creche.decideApproval',
                    { bookingId: booking.id, approvalId: approval.id, decision: 'approved' },
                    actor,
                  ),
                  'Pickup approved.',
                )
              }
            >
              Approve
            </Button>
          </div>
        </div>
      )}

      {inRoom && (
        <ol className="border-border-card flex flex-col gap-1 border-s ps-3">
          {timeline.map((t, i) => (
            <li key={i} className="text-body-3 text-text-muted">
              <span className="text-text-body tabular-nums">{fmtTime(t.at)}</span> · {t.label}
            </li>
          ))}
        </ol>
      )}

      {!inRoom && (
        <Button
          variant="tertiary"
          onClick={() =>
            run(dispatch('creche.cancel', { bookingId: booking.id }, actor), 'Booking cancelled.')
          }
        >
          Cancel booking
        </Button>
      )}
    </Card>
  );
}
