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
import { BodySheet } from '@/ui/BodySheet';
import { SectionHeading } from '@/ui/SectionHeading';
import { TicketCard } from '@/ui/TicketCard';
import { EventCard } from '@/ui/EventCard';
import { Rise } from '@/ui/Rise';
import { useStore } from '@/store';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import { selectActiveBannersForResident } from '@/store/selectors/comms';
import { selectNextPadelBooking } from '@/store/selectors/bookings';
import type { DeviceSlotId } from '@/types/demo';
import { Hero } from './Hero';
import { TodayStrip } from './TodayStrip';
import { SosSheet } from './parts/SosSheet';
import { useState } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { toDubai } from '@/lib/time';
import { useAmenityLabel, useFmt, useT } from '@/i18n/hooks';

export function HomeScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const amenityLabel = useAmenityLabel();
  const [sosOpen, setSosOpen] = useState(false);
  const bookings = useStore((s) => s.bookings);
  const events = useStore((s) => s.events);
  const showtimes = useStore((s) => s.showtimes);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const now = useStore((s) => s.demo.clock.now);
  const resident = useStore((s) => s.residents[actorId]);
  const amenities = useStore((s) => s.amenities);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const announcements = useStore((s) => s.announcements);
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
  const nextBooking = selectNextPadelBooking(bookings, resident.id, now);
  const weekStart = startOfWeek(toDubai(now));
  const weekEnd = endOfWeek(toDubai(now));
  const thisWeek = Object.values(showtimes)
    .filter((sh) => {
      const d = toDubai(sh.start);
      return (
        sh.state !== 'cancelled' &&
        events[sh.eventId]?.lifecycle === 'published' &&
        sh.end > now &&
        d >= weekStart &&
        d <= weekEnd
      );
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  function openAmenity(key: string) {
    push('amenity-detail', { key });
  }

  return (
    <div className="flex flex-col">
      <Hero
        name={resident.name.split(' ')[0] ?? resident.name}
        unitId={resident.unitId}
        now={now}
        onSos={() => setSosOpen(true)}
      />
      <SosSheet slot={slot} open={sosOpen} onClose={() => setSosOpen(false)} />

      <BodySheet>
        {activeBanners.length > 0 && (
          <div className="flex flex-col gap-2">
            {activeBanners.map((a) => (
              <Banner
                key={a.id}
                style={a.banner!.style}
                cta={
                  a.banner?.cta
                    ? {
                        label: t('resident.home.view'),
                        onClick: () => openDeepLink(a.banner!.cta!),
                      }
                    : undefined
                }
              >
                {a.body}
              </Banner>
            ))}
          </div>
        )}

        {nextBooking && (
          <TicketCard
            eyebrow={fmt.dateTime(nextBooking.start)}
            title={amenityLabel('padel')}
            subtitle={`${fmt.time(nextBooking.start)} – ${fmt.time(nextBooking.end)}`}
            stubLabel={t('resident.home.pass')}
            onClick={() => push('padel-pass', { id: nextBooking.id })}
          />
        )}

        <section>
          <SectionHeading
            title={t('resident.home.today')}
            linkLabel={t('resident.home.allSpaces')}
            onLink={() => push('amenities')}
          />
          {status === 'loading' ? (
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="rounded-tile h-24 w-32 shrink-0" />
              ))}
            </div>
          ) : (
            <TodayStrip amenities={data.list} statusByKey={data.statusByKey} onOpen={openAmenity} />
          )}
        </section>

        <section className="grid grid-cols-3 gap-2.5">
          <QuickActionTile
            icon={CalendarDays}
            label={t('resident.home.quick.amenities')}
            onClick={() => push('amenities')}
          />
          <QuickActionTile
            icon={Building2}
            label={t('resident.home.quick.bookings')}
            onClick={() => push('activity', { tab: 'bookings' })}
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

        <section>
          <SectionHeading
            title={t('resident.home.thisWeek')}
            linkLabel={t('resident.home.calendar')}
            onLink={() => push('whats-on')}
          />
          {thisWeek.length === 0 ? (
            <div className="rounded-tile border-border-card border-[0.5px] border-dashed px-4 py-8 text-center">
              <p className="font-serif-display text-serif-section text-text-title">
                {t('resident.home.nothingThisWeekTitle')}
              </p>
              <p className="text-body-2 text-text-muted mt-1">
                {t('resident.home.nothingThisWeek')}
              </p>
            </div>
          ) : (
            <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
              {thisWeek.map((sh, i) => {
                const event = events[sh.eventId]!;
                return (
                  <Rise key={sh.id} i={i}>
                    <EventCard
                      poster={event.poster}
                      when={`${fmt.date(sh.start)} · ${fmt.time(sh.start)}`}
                      title={event.title}
                      where={t(`amenity.${event.venue}.name`)}
                      onClick={() => push('event-detail', { eventId: event.id, showtimeId: sh.id })}
                    />
                  </Rise>
                );
              })}
            </div>
          )}
        </section>
      </BodySheet>
    </div>
  );
}
