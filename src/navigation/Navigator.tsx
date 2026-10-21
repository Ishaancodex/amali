'use client';

/**
 * Per-device stack navigator with iOS-style push/pop transitions (PRD M3,
 * TRD §6). Renders up to the top 4 stack entries; screens below the top
 * stay mounted (hidden, non-interactive) so their scroll position
 * persists. Edge-swipe-to-go-back uses a drag gesture on the top screen.
 */
import { useRef } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { dur, ease } from '@/design/motion';
import { useNav } from './useNav';
import { useLocale } from '@/i18n/hooks';
import type { DeviceSlotId, NavStackEntry } from '@/types/demo';

export type RouteComponent = (params: Record<string, string>) => React.ReactNode;

export interface NavigatorProps {
  slot: DeviceSlotId;
  routes: Record<string, RouteComponent>;
  notFound?: React.ReactNode;
}

const MAX_MOUNTED = 4;
const SWIPE_DISMISS_VELOCITY = 500;
const SWIPE_DISMISS_FRACTION = 0.3;

function entryKey(depth: number, entry: NavStackEntry): string {
  return `${depth}:${entry.route}:${JSON.stringify(entry.params)}`;
}

export function Navigator({ slot, routes, notFound }: NavigatorProps) {
  const { stack, pop } = useNav(slot);
  // RTL mirrors the push direction and the swipe-back edge (PRD M3, §14). Arabic is the only RTL locale.
  const mirror = useLocale() === 'ar' ? -1 : 1;
  const containerRef = useRef<HTMLDivElement>(null);

  if (stack.length === 0) {
    return <div className="relative h-full w-full overflow-hidden" />;
  }

  const startDepth = Math.max(0, stack.length - MAX_MOUNTED);
  const mounted = stack.slice(startDepth);
  const topDepth = stack.length - 1;
  const canPop = stack.length > 1;

  function handleDragEnd(_: unknown, info: PanInfo) {
    const offsetX = info.offset.x * mirror;
    const velocityX = info.velocity.x * mirror;
    if (
      canPop &&
      (velocityX > SWIPE_DISMISS_VELOCITY || offsetX > window.innerWidth * SWIPE_DISMISS_FRACTION)
    ) {
      pop();
    }
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <AnimatePresence initial={false}>
        {mounted.map((entry, i) => {
          const depth = startDepth + i;
          const isTop = depth === topDepth;
          const Component = routes[entry.route] ?? (() => notFound ?? null);
          return (
            <motion.div
              key={entryKey(depth, entry)}
              className="bg-bg-page absolute inset-0 overflow-x-hidden overflow-y-auto"
              style={{ zIndex: depth }}
              initial={{ x: `${100 * mirror}%`, opacity: 1 }}
              animate={isTop ? { x: 0, opacity: 1 } : { x: `${-30 * mirror}%`, opacity: 0.9 }}
              exit={{
                x: `${100 * mirror}%`,
                opacity: 1,
                transition: { duration: dur.slow, ease: ease.standard },
              }}
              transition={{ duration: dur.slow, ease: ease.standard }}
              drag={isTop && canPop ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={mirror === 1 ? { left: 0, right: 0.5 } : { left: 0.5, right: 0 }}
              onDragEnd={handleDragEnd}
              aria-hidden={!isTop}
              inert={!isTop}
            >
              {Component(entry.params)}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
