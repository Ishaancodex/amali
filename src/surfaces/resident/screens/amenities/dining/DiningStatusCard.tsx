'use client';

/** The unit's upcoming and recent reservations on the Dining page — tap one for its detail. */
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { addDaysIso, fmtDateTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';

const VENUE = { restaurant: 'Restaurant', pdr: 'Private Dining', teppanyaki: 'Teppanyaki' };
const RECENT_DAYS = 2;

export function DiningStatusCard({ slot }: { slot: DeviceSlotId }) {
  const { push } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const unitId = useStore((s) => s.residents[actorId]?.unitId);
  const reservations = useStore((s) => s.reservations);
  const now = useStore((s) => s.demo.clock.now);

  const mine = Object.values(reservations)
    .filter(
      (r) =>
        r.unitId === unitId &&
        (['requested', 'confirmed', 'seated'].includes(r.state) ||
          (r.state === 'completed' && r.start > addDaysIso(now, -RECENT_DAYS))),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  if (mine.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label-1 text-text-title">Your reservations</h2>
      {mine.map((r) => (
        <button
          key={r.id}
          type="button"
          className="text-start"
          onClick={() => push('reservation-detail', { id: r.id })}
        >
          <Card className="flex items-center justify-between gap-2">
            <div>
              <p className="text-label-2 text-text-title">
                {VENUE[r.venue]} · {r.partySize}
              </p>
              <p className="text-body-3 text-text-muted">{fmtDateTime(r.start)}</p>
            </div>
            <Tag
              variant={
                r.state === 'completed' ? 'info' : r.state === 'requested' ? 'warning' : 'success'
              }
            >
              {r.state === 'completed'
                ? 'Receipt'
                : r.state === 'requested'
                  ? 'Request'
                  : r.state === 'seated'
                    ? 'Seated'
                    : 'Confirmed'}
            </Tag>
          </Card>
        </button>
      ))}
    </section>
  );
}
