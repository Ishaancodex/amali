'use client';

/**
 * The console shell (TRD §9, PRD §8.10–§8.11): a left rail with the demo's
 * role sub-switch and the sections this role may open, and a pushed-screen
 * content area. Hidden items are absent; switching role while on a page
 * the new role can't open goes back to Overview with "Not available for
 * <role>"; a deep link into such a page shows the no-permission state
 * (`RouteGuard`, in routes.tsx).
 */
import { useEffect, useRef } from 'react';
import { Navigator } from '@/navigation/Navigator';
import { useNav } from '@/navigation/useNav';
import {
  BarChart3,
  CalendarDays,
  LayoutGrid,
  Megaphone,
  Shield,
  Users,
  Wrench,
  Lock,
} from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { canOpenRoute } from '@/config/consoleAccess';
import { useT } from '@/i18n/hooks';
import { cn } from '@/lib/cn';
import type { ConsoleRole, DeviceSlotId } from '@/types/demo';
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
  'blackout',
]);

const NAV_ITEMS = [
  {
    route: 'overview',
    label: 'console.nav.overview',
    icon: LayoutGrid,
    matches: (r: string) => r === 'overview',
  },
  {
    route: 'home',
    label: 'console.nav.comms',
    icon: Megaphone,
    matches: (r: string) => r === 'home' || r === 'composer' || r === 'announcement-detail',
  },
  {
    route: 'ops',
    label: 'console.nav.ops',
    icon: Wrench,
    matches: (r: string) => OPS_ROUTES.has(r),
  },
  {
    route: 'programme',
    label: 'console.nav.programme',
    icon: CalendarDays,
    matches: (r: string) => r === 'programme' || r === 'programme-edit',
  },
  {
    route: 'residents',
    label: 'console.nav.residents',
    icon: Users,
    matches: (r: string) => r === 'residents',
  },
  {
    route: 'reports',
    label: 'console.nav.reports',
    icon: BarChart3,
    matches: (r: string) => r === 'reports',
  },
  {
    route: 'roles',
    label: 'console.nav.roles',
    icon: Shield,
    matches: (r: string) => r === 'roles',
  },
] as const;

const ROLES: ConsoleRole[] = ['community_manager', 'amenity_supervisor', 'call_centre'];

export function ConsoleApp({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const { current, resetTo } = useNav(slot);
  const { actor, consoleRole } = useConsoleActor(slot);
  const staffMember = useStore((s) => (actor ? s.staff[actor.id] : undefined));
  const setConsoleRole = useStore((s) => s.setConsoleRole);
  const pushToast = useUiStore((s) => s.pushToast);
  const previousRole = useRef(consoleRole);

  // PRD §8.11 edge case: the role switches while a restricted page is open.
  useEffect(() => {
    if (
      previousRole.current &&
      consoleRole &&
      previousRole.current !== consoleRole &&
      current &&
      !canOpenRoute(consoleRole, current.route)
    ) {
      resetTo('overview');
      pushToast(
        slot,
        t('console.notAvailableFor', { role: t(`console.role.${consoleRole}`) }),
        'neutral',
      );
    }
    previousRole.current = consoleRole;
  }, [consoleRole, current, resetTo, pushToast, slot, t]);

  return (
    <div className="flex h-full w-full">
      <aside className="border-border-card bg-surface flex w-56 shrink-0 flex-col gap-1 border-e p-3">
        <div className="mb-2 px-2">
          <p className="text-label-2 text-text-title">{staffMember?.name ?? t('console.title')}</p>
          <div
            className="mt-2 flex flex-col gap-1"
            role="radiogroup"
            aria-label={t('console.roleSwitch')}
          >
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={consoleRole === r}
                onClick={() => setConsoleRole(slot, r)}
                className={cn(
                  'rounded-tag text-label-3 px-2 py-1 text-start',
                  consoleRole === r ? 'bg-brand text-on-brand' : 'text-text-muted',
                )}
              >
                {t(`console.role.${r}`)}
              </button>
            ))}
          </div>
        </div>
        {NAV_ITEMS.filter((item) => canOpenRoute(consoleRole, item.route)).map((item) => {
          const active = !!current && item.matches(current.route);
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => resetTo(item.route)}
              className={`rounded-input flex items-center gap-2.5 px-3 py-2.5 text-start ${active ? 'bg-brand-tint text-brand' : 'text-text-body'}`}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-label-2">{t(item.label)}</span>
            </button>
          );
        })}
        {consoleRole === 'call_centre' && (
          <p className="text-body-3 text-text-muted mt-auto flex items-center gap-1.5 px-2">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t('console.askCm')}
          </p>
        )}
      </aside>
      <div className="relative min-h-0 flex-1">
        <Navigator slot={slot} routes={consoleRoutes(slot)} />
      </div>
    </div>
  );
}
