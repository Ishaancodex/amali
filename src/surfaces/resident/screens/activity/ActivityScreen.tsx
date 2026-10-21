'use client';

/**
 * Activity (PRD §6.1): notifications, and the resident's bookings — padel courts and event RSVPs,
 * split into upcoming and past. "My Bookings" on Home opens the Bookings tab directly.
 */
import { useState } from 'react';
import { ScreenShell } from '@/ui/ScreenShell';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { Rise } from '@/ui/Rise';
import { Eyebrow } from '@/ui/Eyebrow';
import { EmptyState } from '@/ui/EmptyState';
import { Tag, type TagVariant } from '@/ui/Tag';
import { Button } from '@/ui/Button';
import { Bell, CalendarDays, Ticket } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { useAmenityLabel, useFmt, useT } from '@/i18n/hooks';
import type { Fmt } from '@/i18n/format';
import type { DeviceSlotId } from '@/types/demo';
import type { BookingState } from '@/types/booking';

type Tab = 'notifications' | 'bookings';

interface Row {
  id: string;
  start: string;
  end: string;
  title: string;
  detail: string;
  state: string;
  variant: TagVariant;
  upcoming: boolean;
  passId?: string;
}

const BOOKING_VARIANT: Record<BookingState, TagVariant> = {
  held: 'warning',
  confirmed: 'success',
  checked_in: 'info',
  completed: 'brand',
  cancelled: 'maintenance',
  late_cancelled: 'warning',
  no_show: 'danger',
  cancelled_by_ops: 'maintenance',
};

function DateBlock({ iso, fmt }: { iso: string; fmt: Fmt }) {
  return (
    <div className="border-border-card flex w-14 shrink-0 flex-col items-center border-e-[0.5px] pe-3.5">
      <Eyebrow>{fmt.date(iso, 'EEE')}</Eyebrow>
      <span className="font-serif-display text-serif-numeral text-text-title">
        {fmt.date(iso, 'd')}
      </span>
      <Eyebrow>{fmt.date(iso, 'MMM')}</Eyebrow>
    </div>
  );
}

export function ActivityScreen({ slot, initialTab }: { slot: DeviceSlotId; initialTab?: Tab }) {
  const t = useT();
  const fmt = useFmt();
  const amenityLabel = useAmenityLabel();
  const { push } = useNav(slot);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const now = useStore((s) => s.demo.clock.now);
  const notificationsRecord = useStore((s) => s.notifications);
  const bookingsRecord = useStore((s) => s.bookings);
  const rsvpsRecord = useStore((s) => s.rsvps);
  const showtimesRecord = useStore((s) => s.showtimes);
  const eventsRecord = useStore((s) => s.events);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'notifications');

  const notifications = Object.values(notificationsRecord)
    .filter((n) => n.recipientId === actorId)
    .sort((a, b) => b.at.localeCompare(a.at));
  const unread = notifications.filter((n) => !n.read).length;

  const rows: Row[] = [
    ...Object.values(bookingsRecord)
      .filter((b) => b.bookerId === actorId && b.state !== 'held')
      .map((b) => ({
        id: b.id,
        start: b.start,
        end: b.end,
        title: amenityLabel('padel'),
        detail: `${fmt.time(b.start)} – ${fmt.time(b.end)}`,
        state: t(`resident.activity.state.${b.state}`),
        variant: BOOKING_VARIANT[b.state],
        upcoming: (b.state === 'confirmed' || b.state === 'checked_in') && b.end > now,
        passId: b.state === 'confirmed' || b.state === 'checked_in' ? b.id : undefined,
      })),
    ...Object.values(rsvpsRecord)
      .filter((r) => r.bookerId === actorId && r.state !== 'held')
      .flatMap((r) => {
        const sh = showtimesRecord[r.showtimeId];
        const ev = sh ? eventsRecord[sh.eventId] : undefined;
        if (!sh || !ev) return [];
        const live = r.state === 'confirmed';
        return [
          {
            id: r.id,
            start: sh.start,
            end: sh.end,
            title: ev.title,
            detail: `${fmt.time(sh.start)} – ${fmt.time(sh.end)} · ${t('resident.activity.party', { count: r.attendees.length })}`,
            state: t(
              live ? 'resident.activity.state.confirmed' : 'resident.activity.state.cancelled',
            ),
            variant: live ? ('success' as const) : ('maintenance' as const),
            upcoming: live && sh.end > now,
          },
        ];
      }),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = rows.filter((r) => r.upcoming);
  const past = rows.filter((r) => !r.upcoming).reverse();

  function list(items: Row[], offset = 0) {
    return items.map((r, i) => (
      <Rise key={r.id} i={i + offset}>
        <div className="border-border-card flex gap-4 border-b-[0.5px] py-4 last:border-b-0">
          <DateBlock iso={r.start} fmt={fmt} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif-display text-serif-section text-text-title">{r.title}</p>
              <Tag variant={r.variant}>{r.state}</Tag>
            </div>
            <p className="text-body-3 text-text-muted mt-1">{r.detail}</p>
            {r.passId && (
              <Button
                variant="secondary"
                className="mt-3 h-9 px-4"
                onClick={() => push('padel-pass', { id: r.passId! })}
              >
                <Ticket className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t('resident.home.pass')}
              </Button>
            )}
          </div>
        </div>
      </Rise>
    ));
  }

  return (
    <ScreenShell
      eyebrow={t('resident.activity.unread', { count: unread })}
      title={t('resident.nav.activity')}
      image="/stock/activity.jpg"
    >
      <SegmentedTabs
        items={(['notifications', 'bookings'] as const).map((k) => ({
          id: k,
          label: t(`resident.activity.tab.${k}`),
        }))}
        value={tab}
        onChange={setTab}
      />
      {tab === 'notifications' &&
        (notifications.length === 0 ? (
          <EmptyState icon={Bell} message={t('resident.activity.noNotifications')} />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n, i) => (
              <li key={n.id}>
                <Rise
                  i={i}
                  className="border-border-card relative flex flex-col gap-0.5 border-b-[0.5px] py-3.5 ps-4"
                >
                  {!n.read && (
                    <span className="bg-brand absolute start-0 top-5 h-1.5 w-1.5 rounded-full" />
                  )}
                  <p className="text-label-2 text-text-title">{n.title}</p>
                  <p className="text-body-3 text-text-muted">{n.body}</p>
                  <Eyebrow className="mt-1">{fmt.dateTime(n.at)}</Eyebrow>
                </Rise>
              </li>
            ))}
          </ul>
        ))}
      {tab === 'bookings' &&
        (rows.length === 0 ? (
          <EmptyState icon={CalendarDays} message={t('resident.activity.noBookings')} />
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <Eyebrow className="text-brand block">{t('resident.activity.upcoming')}</Eyebrow>
                {list(upcoming)}
              </section>
            )}
            {past.length > 0 && (
              <section>
                <Eyebrow className="block">{t('resident.activity.past')}</Eyebrow>
                {list(past, upcoming.length)}
              </section>
            )}
          </>
        ))}
    </ScreenShell>
  );
}
