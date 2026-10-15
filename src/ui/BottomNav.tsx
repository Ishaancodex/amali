'use client';

/**
 * Bottom nav (PRD §5.7): Home · My Unit · Search · Activity · Profile.
 * Active item is bronze; tapping resets that tab's stack to its root.
 */
import { Home, Building2, Search, Activity, User } from './icons';
import type { LucideIcon } from './icons';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';

const TABS: { route: string; label: string; icon: LucideIcon }[] = [
  { route: 'home', label: 'Home', icon: Home },
  { route: 'my-unit', label: 'My Unit', icon: Building2 },
  { route: 'search', label: 'Search', icon: Search },
  { route: 'activity', label: 'Activity', icon: Activity },
  { route: 'profile', label: 'Profile', icon: User },
];

export function BottomNav({ slot }: { slot: DeviceSlotId }) {
  const { current, resetTo } = useNav(slot);
  const activeRoute = current?.route;

  return (
    <nav className="border-border-card bg-surface shadow-bar flex shrink-0 justify-around border-t-[0.5px] pt-2 pb-2">
      {TABS.map(({ route, label, icon: TabIcon }) => {
        const active = activeRoute === route;
        return (
          <button
            key={route}
            type="button"
            onClick={() => resetTo(route)}
            className="flex flex-1 flex-col items-center gap-1 pb-2"
          >
            <TabIcon
              className={`h-5 w-5 transition-colors ${active ? 'text-brand' : 'text-text-muted'}`}
              strokeWidth={1.5}
            />
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
