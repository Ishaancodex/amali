'use client';

/**
 * What needs a person on the board (PRD §8.3): late pickups with a running
 * timer, collectors waiting on a parent's approval (live), and children
 * the end-of-day sweep found still checked in — the lead resolves each.
 */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { ChildAvatar } from '@/features/creche/ChildAvatar';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import { rules } from '@/config/rules';
import { lateFeeFils, lateMinutes } from '@/domain/creche/fees';
import { fmtTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import { useCrecheStaff } from '../../useCrecheStaff';

export function AttentionList({ slot }: { slot: DeviceSlotId }) {
  const { push } = useNav(slot);
  const { actor, isLead } = useCrecheStaff(slot);
  const dispatch = useStore((s) => s.dispatch);
  const pushToast = useUiStore((s) => s.pushToast);
  const crecheBookings = useStore((s) => s.crecheBookings);
  const crecheSessions = useStore((s) => s.crecheSessions);
  const children = useStore((s) => s.children);
  const now = useStore((s) => s.demo.clock.now);
  const { graceMinutes, feePer15MinFils } = rules.creche.latePickup;

  const inRoom = Object.values(crecheBookings).filter((b) => b.state === 'checked_in');
  const rows = inRoom
    .map((b) => {
      const end = crecheSessions[b.sessionId]?.end ?? now;
      return {
        booking: b,
        child: children[b.childId],
        late: lateMinutes(end, now, graceMinutes),
        end,
      };
    })
    .filter((r) => r.late > 0 || r.booking.pendingApproval || r.booking.flaggedAtSweep)
    .sort((a, b) => b.late - a.late);

  function resolve(bookingId: string) {
    if (!actor) return;
    const result = dispatch(
      'creche.resolveSweep',
      { bookingId, note: 'Resolved from the board' },
      actor,
    );
    pushToast(
      slot,
      result.ok ? 'Resolved.' : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label-1 text-text-title">Needs attention</h2>
      {rows.map(({ booking, child, late, end }) => {
        const approval = booking.pendingApproval;
        return (
          <Card key={booking.id} className="flex items-center gap-3">
            <ChildAvatar initials={child?.photo ?? '?'} />
            <div className="min-w-0 flex-1">
              <p className="text-label-2 text-text-title">{child?.name}</p>
              {booking.flaggedAtSweep ? (
                <p className="text-body-3 text-danger">Still checked in at the end-of-day sweep</p>
              ) : late > 0 ? (
                <p className="text-body-3 text-danger">
                  Late pickup · {late} min · AED{' '}
                  {lateFeeFils(end, now, graceMinutes, feePer15MinFils) / 100}
                </p>
              ) : null}
              {approval && (
                <p className="text-body-3 text-text-muted">
                  {approval.collectorName} ·{' '}
                  {approval.state === 'pending'
                    ? `waiting for parent approval since ${fmtTime(approval.requestedAt)}`
                    : `parent ${approval.state}`}
                </p>
              )}
            </div>
            {booking.flaggedAtSweep && isLead ? (
              <Button variant="secondary" onClick={() => resolve(booking.id)}>
                Resolve
              </Button>
            ) : approval ? (
              <Tag
                variant={
                  approval.state === 'approved'
                    ? 'success'
                    : approval.state === 'denied'
                      ? 'danger'
                      : 'warning'
                }
              >
                {approval.state === 'pending'
                  ? 'Waiting'
                  : approval.state === 'approved'
                    ? 'Approved'
                    : 'Denied'}
              </Tag>
            ) : (
              <Button variant="secondary" onClick={() => push('check', { child: booking.childId })}>
                Check out
              </Button>
            )}
          </Card>
        );
      })}
    </section>
  );
}
