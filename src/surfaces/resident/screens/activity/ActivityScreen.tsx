'use client';

/** Activity (PRD §6.1): notifications + booking history (upcoming/past/cancelled). */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { EmptyState } from '@/ui/EmptyState';
import { Bell, CalendarDays } from '@/ui/icons';
import { useStore } from '@/store';
import { fmtDateTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';

type Tab = 'notifications' | 'bookings';

export function ActivityScreen({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const notificationsRecord = useStore((s) => s.notifications);
  const notifications = Object.values(notificationsRecord)
    .filter((n) => n.recipientId === actorId)
    .sort((a, b) => b.at.localeCompare(a.at));
  const [tab, setTab] = useState<Tab>('notifications');

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Activity" />
      <div className="flex gap-1 px-4 pb-3">
        {(['notifications', 'bookings'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-tag text-label-3 px-3 py-1.5 capitalize transition-colors ${
              tab === t ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {tab === 'notifications' &&
          (notifications.length === 0 ? (
            <EmptyState icon={Bell} message="No notifications yet." />
          ) : (
            <ul className="divide-border-card flex flex-col divide-y">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  {!n.read && (
                    <span className="bg-brand mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                  )}
                  <div className={n.read ? 'pl-3.5' : ''}>
                    <p className="text-label-2 text-text-body">{n.title}</p>
                    <p className="text-body-3 text-text-muted">{n.body}</p>
                    <p className="text-body-3 text-text-placeholder mt-0.5">{fmtDateTime(n.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ))}
        {tab === 'bookings' && (
          <EmptyState
            icon={CalendarDays}
            message="No bookings yet. Book the padel court once booking opens."
          />
        )}
      </div>
    </div>
  );
}
