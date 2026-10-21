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
import { Banner } from '@/ui/Banner';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import { selectActiveBannersForResident } from '@/store/selectors/comms';
import type { DeviceSlotId } from '@/types/demo';
import { Hero } from './Hero';
import { TodayStrip } from './TodayStrip';
import { useT } from '@/i18n/hooks';

export function HomeScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const now = useStore((s) => s.demo.clock.now);
  const resident = useStore((s) => s.residents[actorId]);
  const amenities = useStore((s) => s.amenities);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const announcements = useStore((s) => s.announcements);
  const pushToast = useUiStore((s) => s.pushToast);
  const { push, openDeepLink } = useNav(slot);

  const { status, data } = useSimulatedQuery(`home:${actorId}`, () => {
    const list = Object.values(amenities);
    const statusByKey = Object.fromEntries(
      list.map((a) => [a.key, selectCurrentStatus({ amenityStatus }, a.key, now)]),
    );
    return { list, statusByKey };
  });

  if (!resident) return null;

  const activeBanners = selectActiveBannersForResident(announcements, resident.id, now);

  function openAmenity(key: string) {
    push('amenity-detail', { key });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <Hero
        name={resident.name.split(' ')[0] ?? resident.name}
        now={now}
        onSos={() => pushToast(slot, t('resident.home.sosToast'), 'neutral')}
      />

      {activeBanners.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeBanners.map((a) => (
            <Banner
              key={a.id}
              style={a.banner!.style}
              cta={
                a.banner?.cta
                  ? { label: t('resident.home.view'), onClick: () => openDeepLink(a.banner!.cta!) }
                  : undefined
              }
            >
              {a.body}
            </Banner>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-label-1 text-text-title px-4">{t('resident.home.today')}</h2>
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
        <QuickActionTile
          icon={CalendarDays}
          label={t('resident.home.quick.amenities')}
          onClick={() => push('amenities')}
        />
        <QuickActionTile
          icon={Building2}
          label={t('resident.home.quick.bookings')}
          onClick={() => push('activity')}
        />
        <QuickActionTile
          icon={CalendarIcon}
          label={t('resident.home.quick.whatsOn')}
          onClick={() => push('whats-on')}
        />
        <QuickActionTile
          icon={Baby}
          label={t('resident.home.quick.kidsClub')}
          onClick={() => push('amenity-detail', { key: 'creche' })}
        />
        <QuickActionTile
          icon={UtensilsCrossed}
          label={t('resident.home.quick.dining')}
          onClick={() => push('amenity-detail', { key: 'dining' })}
        />
        <QuickActionTile
          icon={Wallet}
          label={t('resident.home.quick.wallet')}
          onClick={() => push('wallet')}
        />
      </section>

      <section className="flex flex-col gap-2 px-4">
        <h2 className="text-label-1 text-text-title">{t('resident.home.thisWeek')}</h2>
        <div className="rounded-card border-border-card border-[0.5px] border-dashed px-4 py-8 text-center">
          <p className="text-body-2 text-text-muted">{t('resident.home.nothingThisWeek')}</p>
        </div>
      </section>
    </div>
  );
}
