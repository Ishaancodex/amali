'use client';

/**
 * Arrivals (PRD §8.4): the service's bookings in time order — Seat,
 * Mark no-show (after the 15-minute grace; the +30 auto-flag shows red),
 * open for party size / notes / bill — and Walk-in (+).
 */
import { Button } from '@/ui/Button';
import { Tag } from '@/ui/Tag';
import { EmptyState } from '@/ui/EmptyState';
import { CalendarDays, CircleAlert, Gift, Plus, Clock } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { rules } from '@/config/rules';
import { noShowAllowedFrom } from '@/domain/dining/policy';
import { fmtTime } from '@/lib/time';
import type { ServicePeriod, VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';
import { useService, hasAllergy } from '../../useService';

const STATE_TAG = {
  requested: ['Request', 'warning'],
  confirmed: ['Expected', 'brand'],
  seated: ['Seated', 'success'],
  completed: ['Done', 'info'],
  no_show: ['No-show', 'danger'],
} as const;

export function Arrivals({
  slot,
  venue,
  period,
  onOpen,
  onWalkIn,
}: {
  slot: DeviceSlotId;
  venue: VenueKey;
  period: ServicePeriod | undefined;
  onOpen: (id: string) => void;
  onWalkIn: () => void;
}) {
  const { inService, now } = useService(venue, period);
  const residents = useStore((s) => s.residents);
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const role = useStore((s) => s.staff[actorId]?.role);
  const pushToast = useUiStore((s) => s.pushToast);
  const actor = { kind: 'staff' as const, id: actorId, role };

  const list = inService.filter((r) => r.state in STATE_TAG);

  function run(name: 'dining.seat' | 'dining.markNoShow', reservationId: string, done: string) {
    const result = dispatch(name, { reservationId }, actor);
    pushToast(slot, result.ok ? done : result.error.message, result.ok ? 'success' : 'error');
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-label-1 text-text-title">Arrivals</h2>
        <Button variant="secondary" onClick={onWalkIn}>
          <Plus className="me-1 inline h-4 w-4" strokeWidth={1.5} />
          Walk-in
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={CalendarDays} message="No bookings this service." />
      ) : (
        list.map((r) => {
          const tag = STATE_TAG[r.state as keyof typeof STATE_TAG];
          const canNoShow =
            r.state === 'confirmed' && now >= noShowAllowedFrom(r.start, rules.dining);
          return (
            <div
              key={r.id}
              className={`rounded-card border-[0.5px] p-3 ${r.noShowFlaggedAt && r.state === 'confirmed' ? 'border-danger' : 'border-border-card'}`}
            >
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                className="flex w-full items-start gap-2 text-start"
              >
                <span className="text-label-2 text-text-title tabular-nums">
                  {fmtTime(r.start)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-label-2 text-text-title flex items-center gap-1">
                    <span className="truncate">
                      {r.walkIn ? 'Walk-in' : (residents[r.residentId]?.name ?? 'Guest')}
                    </span>
                    {hasAllergy(r.dietary) && (
                      <CircleAlert className="text-danger h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    )}
                    {r.occasion && (
                      <Gift className="text-brand h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    )}
                  </span>
                  <span className="text-body-3 text-text-muted block">
                    {r.partySize} · {r.tableIds.join('+') || 'no table yet'}
                    {r.runningLateMinutes ? ` · ~${r.runningLateMinutes} min late` : ''}
                  </span>
                </span>
                <Tag variant={tag[1]}>{tag[0]}</Tag>
              </button>
              {r.noShowFlaggedAt && r.state === 'confirmed' && (
                <p className="text-body-3 text-danger mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Auto-flagged {fmtTime(r.noShowFlaggedAt)} — confirm or seat
                </p>
              )}
              {r.state === 'confirmed' && (
                <div className="mt-2 flex gap-2">
                  <Button variant="primary" onClick={() => run('dining.seat', r.id, 'Seated.')}>
                    Seat
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!canNoShow}
                    onClick={() => run('dining.markNoShow', r.id, 'Marked no-show.')}
                  >
                    No-show
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
