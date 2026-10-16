'use client';

/**
 * Announcement detail + analytics (PRD §8.7 M21): a funnel per channel,
 * time-to-reach, the reach meter for urgent sends, and recall/edit.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Tag } from '@/ui/Tag';
import { Input } from '@/ui/Input';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useNav } from '@/navigation/useNav';
import {
  buildFunnel,
  computeTimeToReach,
  reachSummary,
  fmtElapsed,
} from '@/domain/comms/analytics';
import { fmtDateTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';
import type { Channel } from '@/types/comms';
import { useConsoleActor } from '../useConsoleActor';

const CHANNEL_LABEL: Record<Channel, string> = {
  app_push: 'App push',
  app_banner: 'App banner',
  app_inbox: 'App inbox',
  wa_direct: 'WhatsApp 1:1',
  wa_channel: 'WhatsApp Channel',
  sms_fallback: 'SMS fallback',
};

export function AnnouncementDetailScreen({
  slot,
  announcementId,
}: {
  slot: DeviceSlotId;
  announcementId: string;
}) {
  const { pop } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);
  const dispatch = useStore((s) => s.dispatch);
  const now = useStore((s) => s.demo.clock.now);
  const announcement = useStore((s) => s.announcements[announcementId]);
  const deliveries = useStore((s) => s.deliveries);
  const { actor } = useConsoleActor(slot);
  const [editTitle, setEditTitle] = useState('');
  const [editing, setEditing] = useState(false);

  if (!announcement) return null;

  const myDeliveries = Object.values(deliveries).filter(
    (d) => d.messageRef.type === 'announcement' && d.messageRef.id === announcementId,
  );
  const funnel = buildFunnel(myDeliveries);
  const timeToReach = announcement.sentAt
    ? computeTimeToReach(myDeliveries, announcement.sentAt)
    : undefined;
  const reach = announcement.sentAt
    ? reachSummary(myDeliveries, announcement.sentAt, now)
    : undefined;

  function recall() {
    if (!actor) return;
    const result = dispatch('announcement.recall', { announcementId }, actor);
    pushToast(
      slot,
      result.ok ? 'Recalled.' : result.error.message,
      result.ok ? 'success' : 'error',
    );
  }

  function saveEdit() {
    if (!actor) return;
    const result = dispatch('announcement.edit', { announcementId, title: editTitle }, actor);
    pushToast(slot, result.ok ? 'Updated.' : result.error.message, result.ok ? 'success' : 'error');
    setEditing(false);
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={announcement.title} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <section className="flex items-center gap-2">
            <Tag variant={announcement.type === 'urgent' ? 'danger' : 'brand'}>
              {announcement.type}
            </Tag>
            <Tag
              variant={
                announcement.state === 'recalled'
                  ? 'warning'
                  : announcement.state === 'sent'
                    ? 'success'
                    : 'info'
              }
            >
              {announcement.state}
            </Tag>
            {announcement.editedAt && <Tag variant="info">Edited</Tag>}
            <span className="text-body-3 text-text-muted">
              {announcement.sentAt ? `Sent ${fmtDateTime(announcement.sentAt)}` : 'Not sent yet'}
            </span>
          </section>

          <p className="text-body-2 text-text-body whitespace-pre-line">{announcement.body}</p>

          {announcement.state === 'sent' && (
            <section className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing((v) => !v);
                  setEditTitle(announcement.title);
                }}
              >
                Edit
              </Button>
              <Button variant="destructive" onClick={recall}>
                Recall
              </Button>
            </section>
          )}
          {editing && (
            <section className="flex items-end gap-2">
              <Input
                label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1"
              />
              <Button onClick={saveEdit}>Save</Button>
            </section>
          )}

          {announcement.type === 'urgent' && reach && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">Reach</h2>
              <p className="text-title-l text-text-title">
                {reach.reached} of {reach.total} reached in {fmtElapsed(reach.elapsedSeconds)}
              </p>
            </section>
          )}

          {funnel.length > 0 && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">Delivery funnel</h2>
              <div className="flex flex-col gap-2">
                {funnel.map((f) => (
                  <div
                    key={f.channel}
                    className="rounded-card border-border-card border-[0.5px] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-label-2 text-text-title">
                        {CHANNEL_LABEL[f.channel]}
                      </span>
                      <span className="text-body-3 text-text-muted">{f.total} total</span>
                    </div>
                    <div className="text-body-3 mt-2 flex gap-4">
                      <span>Sent {f.sent}</span>
                      <span>Delivered {f.delivered}</span>
                      <span>Read {f.read}</span>
                      {f.failed > 0 && <span className="text-danger">Failed {f.failed}</span>}
                    </div>
                    {f.channel === 'wa_channel' && (
                      <p className="text-body-3 text-text-muted mt-1">
                        Channel posts show aggregate views only — no per-recipient read receipts.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {timeToReach && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">Time to reach</h2>
              <div className="text-body-2 text-text-body flex flex-col gap-1">
                <span>
                  Median time to deliver: {timeToReach.medianDeliverMinutes?.toFixed(1) ?? '—'} min
                </span>
                <span>
                  Time to 50% read:{' '}
                  {timeToReach.timeTo50PctReadMinutes?.toFixed(1) ?? 'not yet reached'} min
                </span>
                <span>
                  Time to 90% read:{' '}
                  {timeToReach.timeTo90PctReadMinutes?.toFixed(1) ?? 'not yet reached'} min
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
