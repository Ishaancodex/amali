'use client';

/**
 * Resident Home (PRD §9). Quick actions push onto this device's stack;
 * My Unit/Search/Activity/Profile are reached via the bottom nav instead.
 */
import {
  Building2,
  CalendarDays,
  Baby,
  UtensilsCrossed,
  Wallet,
  Calendar as CalendarIcon,
} from '@/ui/icons';
import { QuickActionTile } from '@/ui/QuickActionTile';
import { Skeleton } from '@/ui/Skeleton';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import type { DeviceSlotId } from '@/types/demo';
import { Hero } from './Hero';
import { TodayStrip } from './TodayStrip';

export function HomeScreen({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const now = useStore((s) => s.demo.clock.now);
  const resident = useStore((s) => s.residents[actorId]);
  const amenities = useStore((s) => s.amenities);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const pushToast = useUiStore((s) => s.pushToast);
  const { push } = useNav(slot);

  const { status, data } = useSimulatedQuery(`home:${actorId}`, () => {
    const list = Object.values(amenities);
    const statusByKey = Object.fromEntries(
      list.map((a) => [a.key, selectCurrentStatus({ amenityStatus }, a.key)]),
    );
    return { list, statusByKey };
  });

  if (!resident) return null;

  function openAmenity(key: string) {
    push('amenity-detail', { key });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <Hero
        name={resident.name.split(' ')[0] ?? resident.name}
        now={now}
        onSos={() => pushToast(slot, 'SOS is a demo prop — no real alert sent.', 'neutral')}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-label-1 text-text-title px-4">Today at Amali</h2>
        {status === 'loading' ? (
          <div className="flex gap-2 px-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="rounded-tag h-9 w-28 shrink-0" />
            ))}
          </div>
        ) : (
          <TodayStrip amenities={data.list} statusByKey={data.statusByKey} onOpen={openAmenity} />
        )}
      </section>

      <section className="grid grid-cols-3 gap-3 px-4">
        <QuickActionTile icon={CalendarDays} label="Amenities" onClick={() => push('amenities')} />
        <QuickActionTile icon={Building2} label="My Bookings" onClick={() => push('activity')} />
        <QuickActionTile icon={CalendarIcon} label="What's On" onClick={() => push('whats-on')} />
        <QuickActionTile
          icon={Baby}
          label="Kids' Club"
          onClick={() => push('amenity-detail', { key: 'creche' })}
        />
        <QuickActionTile
          icon={UtensilsCrossed}
          label="Dining"
          onClick={() => push('amenity-detail', { key: 'dining' })}
        />
        <QuickActionTile icon={Wallet} label="Wallet" onClick={() => push('wallet')} />
      </section>

      <section className="flex flex-col gap-2 px-4">
        <h2 className="text-label-1 text-text-title">What&apos;s on this week</h2>
        <div className="rounded-card border-border-card border-[0.5px] border-dashed px-4 py-8 text-center">
          <p className="text-body-2 text-text-muted">Nothing scheduled this week yet.</p>
        </div>
      </section>
    </div>
  );
}
