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
import { minutesBetween } from '@/lib/time';
import { useErrorText, useFmt, useT, type T } from '@/i18n/hooks';
import type { Child, CrecheBooking } from '@/types/creche';
import { activityLabel } from '@/features/creche/activities';
import type { DeviceSlotId } from '@/types/demo';

function duration(minutes: number, t: T): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? t('kids.durationHm', { h, m }) : t('kids.durationM', { m });
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
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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

  function run(result: { ok: boolean; error?: { code: string; message: string } }, done: string) {
    pushToast(slot, result.ok ? done : errorText(result.error), result.ok ? 'success' : 'error');
  }
  const actor = { kind: 'resident' as const, id: actorId };

  const timeline = [
    {
      at: booking.createdAt,
      label: booking.state === 'waitlisted' ? t('padel.waitlisted') : t('padel.booked'),
    },
    ...(booking.checkIn
      ? [
          {
            at: booking.checkIn.at,
            label: t('kids.checkedInBy', {
              name: staff[booking.checkIn.by]?.name ?? t('kids.staff'),
            }),
          },
        ]
      : []),
    ...(booking.activity ?? []).map((a) => ({ at: a.at, label: activityLabel(a.label, t) })),
  ];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <ChildAvatar initials={child.photo} />
        <div className="min-w-0 flex-1">
          <p className="font-serif-display text-serif-section text-text-title">{first}</p>
          <p className="text-body-3 text-text-muted">
            {inRoom
              ? t('kids.inPlayroom', {
                  time: fmt.time(booking.checkIn!.at),
                  duration: duration(minutesBetween(booking.checkIn!.at, now), t),
                })
              : `${fmt.date(session.start)} · ${fmt.time(session.start)}–${fmt.time(session.end)}`}
          </p>
        </div>
        <Tag variant={inRoom ? 'success' : booking.state === 'waitlisted' ? 'warning' : 'brand'}>
          {inRoom
            ? t('kids.tag.in')
            : booking.state === 'waitlisted'
              ? t('kids.tag.waitlist')
              : t('padel.booked')}
        </Tag>
      </div>

      {inRoom && (
        <div className="bg-brand-tint rounded-tile flex items-center justify-between px-3 py-2">
          <span className="text-label-2 text-brand">
            {activity ? activityLabel(activity.label, t) : t('kids.settlingIn')}
          </span>
          <span className="text-body-3 text-text-muted">{roomSummary}</span>
        </div>
      )}

      {late > 0 && (
        <Banner style="urgent">{t('kids.pickupLate', { time: fmt.time(session.end) })}</Banner>
      )}

      {approval?.state === 'pending' && (
        <div className="flex flex-col gap-2">
          <Banner style="warning">
            {t('kids.approvalAsk', {
              collector: approval.collectorName,
              photo: approval.collectorPhoto,
              name: first,
            })}
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
                  t('kids.pickupDenied'),
                )
              }
            >
              {t('kids.deny')}
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
                  t('kids.pickupApproved'),
                )
              }
            >
              {t('kids.approve')}
            </Button>
          </div>
        </div>
      )}

      {inRoom && (
        <ol className="border-border-card flex flex-col gap-1 border-s ps-3">
          {timeline.map((item, i) => (
            <li key={i} className="text-body-3 text-text-muted">
              <span className="text-text-body tabular-nums">{fmt.time(item.at)}</span> ·{' '}
              {item.label}
            </li>
          ))}
        </ol>
      )}

      {!inRoom && (
        <Button
          variant="tertiary"
          onClick={() =>
            run(
              dispatch('creche.cancel', { bookingId: booking.id }, actor),
              t('padel.toast.cancelled'),
            )
          }
        >
          {t('kids.cancelBooking')}
        </Button>
      )}
    </Card>
  );
}
