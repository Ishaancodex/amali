'use client';

/**
 * The console shell (TRD §9, PRD §8.10-§8.11): a left-rail nav + a
 * pushed-screen content area, mirroring the resident app's `Navigator`
 * pattern. Communications (P5) and Operations (P6) are the first two real
 * sections — Overview, Reports and the role sub-switch land with P10.
 */
import { Navigator } from '@/navigation/Navigator';
import { useNav } from '@/navigation/useNav';
import { Megaphone, Wrench } from '@/ui/icons';
import { useStore } from '@/store';
import type { DeviceSlotId } from '@/types/demo';
import { consoleRoutes } from './routes';
import { useConsoleActor } from './useConsoleActor';

const OPS_ROUTES = new Set([
  'ops',
  'checklist',
  'water',
  'roster',
  'incidents',
  'work-orders',
  'work-order-detail',
  'vendors',
  'audit-log',
]);

const NAV_ITEMS = [
  {
    route: 'home',
    label: 'Communications',
    icon: Megaphone,
    matches: (r: string) => r === 'home' || r === 'composer' || r === 'announcement-detail',
  },
  { route: 'ops', label: 'Operations', icon: Wrench, matches: (r: string) => OPS_ROUTES.has(r) },
] as const;

export function ConsoleApp({ slot }: { slot: DeviceSlotId }) {
  const { current, resetTo } = useNav(slot);
  const { actor, consoleRole } = useConsoleActor(slot);
  const staffMember = useStore((s) => (actor ? s.staff[actor.id] : undefined));

  return (
    <div className="flex h-full w-full">
      <aside className="border-border-card bg-surface flex w-56 shrink-0 flex-col gap-1 border-e p-3">
        <div className="mb-2 px-2">
          <p className="text-label-2 text-text-title">{staffMember?.name ?? 'Console'}</p>
          <p className="text-body-3 text-text-muted capitalize">
            {consoleRole?.replace(/_/g, ' ') ?? 'No role'}
          </p>
        </div>
        {NAV_ITEMS.map((item) => {
          const active = !!current && item.matches(current.route);
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => resetTo(item.route)}
              className={`rounded-input flex items-center gap-2.5 px-3 py-2.5 text-start ${
                active ? 'bg-brand-tint text-brand' : 'text-text-body'
              }`}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-label-2">{item.label}</span>
            </button>
          );
        })}
      </aside>
      <div className="relative min-h-0 flex-1">
        <Navigator slot={slot} routes={consoleRoutes(slot)} />
      </div>
    </div>
  );
}
