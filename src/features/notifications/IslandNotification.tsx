'use client';

/**
 * Incoming notification banner (PRD M13). Drops in from the top, stacks up
 * to 3 (older ones scale down and shift back), auto-collapses after 4s,
 * and deep-links on tap.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell } from 'lucide-react';
import { useStore } from '@/store';
import { spring, dur, ease } from '@/design/motion';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';

const AUTO_COLLAPSE_MS = 4000;
const MAX_STACK = 3;

export function IslandNotification({ slot }: { slot: DeviceSlotId }) {
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId);
  const notifications = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationRead);
  const { openDeepLink } = useNav(slot);

  const [queue, setQueue] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const mine = Object.values(notifications)
      .filter((n) => n.recipientId === actorId && !n.read && !seenRef.current.has(n.id))
      .sort((a, b) => a.at.localeCompare(b.at));
    if (mine.length === 0) return;
    for (const n of mine) seenRef.current.add(n.id);
    setQueue((q) => [...q, ...mine.map((n) => n.id)].slice(-MAX_STACK));
  }, [notifications, actorId]);

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(() => {
      // The store write stays out of the `setQueue` updater: React runs updaters during render,
      // and updating the store there warns "Cannot update a component while rendering".
      const [first] = queue;
      if (first) markRead(first);
      setQueue((q) => q.filter((id) => id !== first));
    }, AUTO_COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [queue, markRead]);

  function dismiss(notifId: string) {
    markRead(notifId);
    setQueue((q) => q.filter((id) => id !== notifId));
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-30 flex flex-col items-center px-4">
      <AnimatePresence initial={false}>
        {queue.map((notifId, i) => {
          const n = notifications[notifId];
          if (!n) return null;
          const depthFromTop = queue.length - 1 - i;
          return (
            <motion.button
              key={notifId}
              type="button"
              onClick={() => {
                dismiss(notifId);
                openDeepLink(n.deepLink);
              }}
              className="rounded-card bg-shell-stage pointer-events-auto absolute w-full max-w-sm px-4 py-3 text-start shadow-xl"
              style={{ zIndex: i }}
              initial={{ opacity: 0, scale: 0.9, y: -16 }}
              animate={{ opacity: 1, scale: 1 - depthFromTop * 0.05, y: depthFromTop * -8 }}
              exit={{ opacity: 0, y: -16, transition: { duration: dur.fast, ease: ease.exit } }}
              transition={spring.snappy}
            >
              <div className="flex items-start gap-2.5">
                <Bell className="text-brand mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <p className="text-label-2 text-shell-stage-active truncate">{n.title}</p>
                  <p className="text-body-3 text-shell-notes-body line-clamp-2">{n.body}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
