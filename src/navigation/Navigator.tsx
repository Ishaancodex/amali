'use client';

/**
 * Per-device stack navigator with iOS-style push/pop transitions (PRD M3,
 * TRD §6). Renders up to the top 4 stack entries; screens below the top
 * stay mounted (hidden, non-interactive) so their scroll position
 * persists. Edge-swipe-to-go-back uses a drag gesture on the top screen.
 */
import { useRef } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { dur, ease, pushUnder } from '@/design/motion';
import { useNav } from './useNav';
import { useLocale } from '@/i18n/hooks';
import type { DeviceSlotId, NavStackEntry } from '@/types/demo';

export type RouteComponent = (params: Record<string, string>) => React.ReactNode;

export interface NavigatorProps {
  slot: DeviceSlotId;
  routes: Record<string, RouteComponent>;
  notFound?: React.ReactNode;
  /** Extra classes for the root (depth 0) screen, e.g. room for a floating tab bar. */
  rootClassName?: string;
}

const MAX_MOUNTED = 4;
const SWIPE_DISMISS_VELOCITY = 500;
const SWIPE_DISMISS_FRACTION = 0.3;

function entryKey(depth: number, entry: NavStackEntry): string {
  return `${depth}:${entry.route}:${JSON.stringify(entry.params)}`;
}

/** How dark the screen at `i` should be: under a pushed (non-morph) screen it dims. */
function depthDim(mounted: NavStackEntry[], i: number, topIndex: number): number {
  const isTop = i === topIndex;
  const aboveMorph = mounted[i + 1]?.params.transition === 'morph';
  return isTop || aboveMorph ? 0 : 1 - pushUnder.brightness;
}

export function Navigator({ slot, routes, notFound, rootClassName }: NavigatorProps) {
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
          // A `transition: 'morph'` screen fades in over a still list so a shared image can travel.
          const morph = entry.params.transition === 'morph';
          const aboveMorph = mounted[i + 1]?.params.transition === 'morph';
          const rest = { x: 0, opacity: 1 };
          return (
            <motion.div
              key={entryKey(depth, entry)}
              className={`bg-bg-page absolute inset-0 overflow-x-hidden overflow-y-auto ${depth === 0 ? (rootClassName ?? '') : ''}`}
              style={{ zIndex: depth }}
              initial={morph ? { ...rest, opacity: 0 } : { ...rest, x: `${100 * mirror}%` }}
              animate={
                isTop || aboveMorph
                  ? rest
                  : {
                      ...rest,
                      x: `${pushUnder.xPct * mirror}%`,
                    }
              }
              exit={
                morph
                  ? { opacity: 0, transition: { duration: dur.slow, ease: ease.soft } }
                  : { x: `${100 * mirror}%`, transition: { duration: dur.slow, ease: ease.soft } }
              }
              transition={{ duration: dur.slower, ease: ease.soft }}
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
      {/* Dims screens pushed under. An overlay, not a `filter` on the screen: a filter would turn
          the screen into the containing block of any `fixed` sheet inside it. */}
      {mounted.map((entry, i) => {
        const dim = depthDim(mounted, i, topDepth - startDepth);
        return (
          <motion.div
            key={`dim:${entryKey(startDepth + i, entry)}`}
            className="bg-ember pointer-events-none absolute inset-0"
            style={{ zIndex: startDepth + i + 0.5 }}
            initial={false}
            animate={{ opacity: dim }}
            transition={{ duration: dur.slower, ease: ease.soft }}
          />
        );
      })}
    </div>
  );
}
