'use client';

/** The unit's upcoming and recent reservations on the Dining page — tap one for its detail. */
import { SectionHeading } from '@/ui/SectionHeading';
import { Card } from '@/ui/Card';
import { Tag } from '@/ui/Tag';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { addDaysIso } from '@/lib/time';
import { useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';

const RECENT_DAYS = 2;

export function DiningStatusCard({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
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
      <SectionHeading title={t('dining.yourReservations')} />
      {mine.map((r) => (
        <button
          key={r.id}
          type="button"
          className="text-start"
          onClick={() => push('reservation-detail', { id: r.id })}
        >
          <Card className="flex items-center justify-between gap-2">
            <div>
              <p className="font-serif-display text-serif-section text-text-title">
                {t(`dining.venue.${r.venue}`)} · {r.partySize}
              </p>
              <p className="text-body-3 text-text-muted">{fmt.dateTime(r.start)}</p>
            </div>
            <Tag
              variant={
                r.state === 'completed' ? 'info' : r.state === 'requested' ? 'warning' : 'success'
              }
            >
              {r.state === 'completed'
                ? t('dining.tag.receipt')
                : r.state === 'requested'
                  ? t('dining.tag.request')
                  : r.state === 'seated'
                    ? t('dining.tag.seated')
                    : t('dining.tag.confirmed')}
            </Tag>
          </Card>
        </button>
      ))}
    </section>
  );
}
