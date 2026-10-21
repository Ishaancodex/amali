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
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';
import { motion } from 'motion/react';
import { spring } from '@/design/motion';

export function AnnouncementDetailScreen({
  slot,
  announcementId,
}: {
  slot: DeviceSlotId;
  announcementId: string;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
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
  const minutes = (v: number | undefined) =>
    v === undefined
      ? t('console.announcement.notReached')
      : t('console.announcement.minutes', { value: v.toFixed(1) });

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
      result.ok ? t('console.announcement.recalled') : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  function saveEdit() {
    if (!actor) return;
    const result = dispatch('announcement.edit', { announcementId, title: editTitle }, actor);
    pushToast(
      slot,
      result.ok ? t('console.announcement.updated') : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
    setEditing(false);
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={announcement.title} onBack={pop} />
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <section className="flex items-center gap-2">
            <Tag variant={announcement.type === 'urgent' ? 'danger' : 'brand'}>
              {t(`console.comms.type.${announcement.type}`)}
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
              {t(`console.comms.state.${announcement.state}`)}
            </Tag>
            {announcement.editedAt && <Tag variant="info">{t('console.announcement.edited')}</Tag>}
            <span className="text-body-3 text-text-muted">
              {announcement.sentAt
                ? t('console.comms.sentAt', { date: fmt.dateTime(announcement.sentAt) })
                : t('console.announcement.notSent')}
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
                {t('common.edit')}
              </Button>
              <Button variant="destructive" onClick={recall}>
                {t('console.announcement.recall')}
              </Button>
            </section>
          )}
          {editing && (
            <section className="flex items-end gap-2">
              <Input
                label={t('console.incidents.title')}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1"
              />
              <Button onClick={saveEdit}>{t('common.save')}</Button>
            </section>
          )}

          {announcement.type === 'urgent' && reach && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('console.announcement.reach')}
              </h2>
              <p className="text-title-l text-text-title">
                {t('console.announcement.reachLine', {
                  reached: reach.reached,
                  total: reach.total,
                  elapsed: fmtElapsed(reach.elapsedSeconds),
                })}
              </p>
            </section>
          )}

          {funnel.length > 0 && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('console.announcement.funnel')}
              </h2>
              <div className="flex flex-col gap-2">
                {funnel.map((f) => (
                  <div
                    key={f.channel}
                    className="rounded-card border-border-card border-[0.5px] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-label-2 text-text-title">
                        {t(`console.channel.${f.channel}`)}
                      </span>
                      <span className="text-body-3 text-text-muted">
                        {t('console.announcement.total', { count: f.total })}
                      </span>
                    </div>
                    <div className="text-body-3 mt-2 flex gap-4">
                      <span>{t('console.announcement.sent', { count: f.sent })}</span>
                      <span>{t('console.announcement.delivered', { count: f.delivered })}</span>
                      <span>{t('console.announcement.read', { count: f.read })}</span>
                      {f.failed > 0 && (
                        <span className="text-danger">
                          {t('console.announcement.failed', { count: f.failed })}
                        </span>
                      )}
                    </div>
                    {/* M21: delivered and read grow as bars from the start edge. */}
                    <div className="bg-brand-tint relative mt-2 h-1.5 overflow-hidden rounded-full">
                      {(['delivered', 'read'] as const).map((k) => (
                        <motion.span
                          key={k}
                          aria-hidden
                          className={`absolute inset-y-0 start-0 w-full origin-left rtl:origin-right ${k === 'read' ? 'bg-brand' : 'bg-brand/40'}`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: f.total ? f[k] / f.total : 0 }}
                          transition={spring.soft}
                        />
                      ))}
                    </div>
                    {f.channel === 'wa_channel' && (
                      <p className="text-body-3 text-text-muted mt-1">
                        {t('console.announcement.channelNote')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {timeToReach && (
            <section>
              <h2 className="text-label-1 text-text-title mb-2">
                {t('console.announcement.timeToReach')}
              </h2>
              <div className="text-body-2 text-text-body flex flex-col gap-1">
                <span>
                  {t('console.announcement.median', {
                    value: minutes(timeToReach.medianDeliverMinutes),
                  })}
                </span>
                <span>
                  {t('console.announcement.to50', {
                    value: minutes(timeToReach.timeTo50PctReadMinutes),
                  })}
                </span>
                <span>
                  {t('console.announcement.to90', {
                    value: minutes(timeToReach.timeTo90PctReadMinutes),
                  })}
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
