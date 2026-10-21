'use client';

/**
 * Bottom nav (PRD §5.7): Home · My Unit · Search · Activity · Profile.
 * Active item is bronze; tapping resets that tab's stack to its root.
 */
import { motion } from 'motion/react';
import { Home, Building2, Search, Activity, User } from './icons';
import { dur, ease } from '@/design/motion';
import type { LucideIcon } from './icons';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';
import { useT } from '@/i18n/hooks';

export interface BottomNavTab {
  route: string;
  /** Already translated. */
  label: string;
  icon: LucideIcon;
}

const RESIDENT_TABS = [
  { route: 'home', label: 'resident.nav.home', icon: Home },
  { route: 'my-unit', label: 'resident.nav.myUnit', icon: Building2 },
  { route: 'search', label: 'resident.nav.search', icon: Search },
  { route: 'activity', label: 'resident.nav.activity', icon: Activity },
  { route: 'profile', label: 'resident.nav.profile', icon: User },
] as const;

/** Defaults to the resident tabs; staff surfaces (Creche) pass their own. */
export function BottomNav({
  slot,
  tabs,
  floating = false,
  hidden = false,
}: {
  slot: DeviceSlotId;
  tabs?: BottomNavTab[];
  /** Resident look: a glass Ember pill floating above the content. */
  floating?: boolean;
  /** Slides away (pushed screens). */
  hidden?: boolean;
}) {
  const t = useT();
  const { current, resetTo } = useNav(slot);
  const shown = tabs ?? RESIDENT_TABS.map((tab) => ({ ...tab, label: t(tab.label) }));
  const activeRoute = current?.route;

  if (floating) {
    return (
      <motion.nav
        className="border-ember-hairline bg-ember-glass rounded-nav absolute inset-x-3 bottom-5 z-30 grid h-(--nav-height) grid-cols-5 border backdrop-blur-xl"
        initial={false}
        animate={{ y: hidden ? '130%' : 0, opacity: hidden ? 0 : 1 }}
        transition={{ duration: dur.slow, ease: ease.soft }}
        style={{ pointerEvents: hidden ? 'none' : 'auto' }}
        aria-hidden={hidden}
      >
        {shown.map(({ route, label, icon: TabIcon }) => {
          const active = activeRoute === route;
          return (
            <button
              key={route}
              type="button"
              onClick={() => resetTo(route)}
              aria-current={active ? 'page' : undefined}
              tabIndex={hidden ? -1 : 0}
              className="relative flex flex-col items-center justify-center gap-1.5"
            >
              {active && (
                <motion.span
                  layoutId={`${slot}:nav-dot`}
                  className="bg-sand-on-ember absolute top-2 h-1 w-1 rounded-full"
                  transition={{ duration: dur.base, ease: ease.soft }}
                />
              )}
              <TabIcon
                className={`mt-1.5 h-5 w-5 transition-colors ${active ? 'text-on-ember' : 'text-on-ember-muted'}`}
                strokeWidth={1.5}
              />
              <span
                className={`font-wide text-eyebrow transition-colors ${active ? 'text-on-ember' : 'text-on-ember-muted'}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </motion.nav>
    );
  }

  return (
    <nav className="border-border-card bg-surface shadow-bar flex shrink-0 justify-around border-t-[0.5px] pt-2 pb-2">
      {shown.map(({ route, label, icon: TabIcon }) => {
        const active = activeRoute === route;
        return (
          <button
            key={route}
            type="button"
            onClick={() => resetTo(route)}
            aria-current={active ? 'page' : undefined}
            className="flex flex-1 flex-col items-center gap-1 pb-2"
          >
            {/* M4: the active icon scales 0.9 → 1 as the bronze fades in. */}
            <motion.span
              className="flex"
              initial={false}
              animate={{ scale: active ? 1 : 0.9 }}
              transition={{ duration: dur.fast, ease: ease.standard }}
            >
              <TabIcon
                className={`h-5 w-5 transition-colors ${active ? 'text-brand' : 'text-text-muted'}`}
                strokeWidth={1.5}
              />
            </motion.span>
            <span
              className={`text-label-3 transition-colors ${active ? 'text-brand' : 'text-text-muted'}`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
