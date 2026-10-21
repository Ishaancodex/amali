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
export function BottomNav({ slot, tabs }: { slot: DeviceSlotId; tabs?: BottomNavTab[] }) {
  const t = useT();
  const { current, resetTo } = useNav(slot);
  const shown = tabs ?? RESIDENT_TABS.map((tab) => ({ ...tab, label: t(tab.label) }));
  const activeRoute = current?.route;

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
