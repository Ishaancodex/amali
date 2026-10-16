'use client';

/**
 * The WhatsApp simulated phone (PRD §8.7): neutral styling, no WhatsApp
 * logo or trademarked artwork. Two tabs — Chats (the one 1:1 business
 * thread) and Channel (the broadcast feed, aggregate views only, no
 * per-recipient read receipts — PRD's explicit Channel-vs-1:1 distinction).
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Tag } from '@/ui/Tag';
import { EmptyState } from '@/ui/EmptyState';
import { MessageCircle, Megaphone, Eye } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { fmtDate, fmtTime } from '@/lib/time';
import type { DeviceSlotId } from '@/types/demo';

type Tab = 'chats' | 'channel';

export function WhatsAppHomeScreen({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const waMessages = useStore((s) => s.waMessages);
  const channelPosts = useStore((s) => s.channelPosts);
  const announcements = useStore((s) => s.announcements);
  const { push } = useNav(slot);
  const [tab, setTab] = useState<Tab>('chats');

  const myMessages = Object.values(waMessages)
    .filter((m) => m.threadResidentId === actorId)
    .sort((a, b) => a.at.localeCompare(b.at));
  const last = myMessages[myMessages.length - 1];

  const posts = Object.values(channelPosts).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex h-full flex-col">
      <TopBar title="WhatsApp" />
      <div className="flex gap-1 px-4 pb-3">
        {(['chats', 'channel'] as const).map((t) => (
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
        {tab === 'chats' &&
          (myMessages.length === 0 ? (
            <EmptyState icon={MessageCircle} message="No messages yet." />
          ) : (
            <button
              type="button"
              onClick={() => push('thread')}
              className="rounded-card border-border-card bg-surface flex w-full items-center gap-3 border-[0.5px] p-3 text-start"
            >
              <span className="bg-brand-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <MessageCircle className="text-brand h-5 w-5" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-label-2 text-text-title">Amali Residences</span>
                  <Tag variant="info" className="px-1.5 py-0.5">
                    business
                  </Tag>
                </div>
                {last && <p className="text-body-3 text-text-muted mt-0.5 truncate">{last.text}</p>}
              </div>
              {last && (
                <span className="text-body-3 text-text-muted shrink-0">{fmtTime(last.at)}</span>
              )}
            </button>
          ))}

        {tab === 'channel' &&
          (posts.length === 0 ? (
            <EmptyState icon={Megaphone} message="No channel updates yet." />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-label-2 text-text-title">Amali Residences — Updates</p>
              {posts.map((post) => {
                const announcement = announcements[post.announcementId];
                if (!announcement) return null;
                return (
                  <div
                    key={post.id}
                    className="rounded-card border-border-card bg-surface flex flex-col gap-1.5 border-[0.5px] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Megaphone className="text-brand h-4 w-4 shrink-0" strokeWidth={1.5} />
                      <span className="text-label-2 text-text-title">{announcement.title}</span>
                    </div>
                    <p className="text-body-2 text-text-body">{announcement.body}</p>
                    <div className="text-body-3 text-text-muted mt-1 flex items-center gap-3">
                      <span>
                        {fmtDate(post.at)} · {fmtTime(post.at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {post.views}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}
