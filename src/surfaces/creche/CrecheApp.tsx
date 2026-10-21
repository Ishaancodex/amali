import { Navigator } from '@/navigation/Navigator';
import { BottomNav, type BottomNavTab } from '@/ui/BottomNav';
import { LayoutGrid, LogIn, CalendarDays, CircleAlert, Baby } from '@/ui/icons';
import type { DeviceSlotId } from '@/types/demo';
import { crecheRoutes } from './routes';
import { useT } from '@/i18n/hooks';

/** PRD §6.3: Room board · Check-in/out · Today's sessions · Incidents · Children directory. */
const TABS = [
  { route: 'home', label: 'creche.nav.board', icon: LayoutGrid },
  { route: 'check', label: 'creche.nav.check', icon: LogIn },
  { route: 'sessions', label: 'creche.nav.sessions', icon: CalendarDays },
  { route: 'incidents', label: 'creche.nav.incidents', icon: CircleAlert },
  { route: 'children', label: 'creche.nav.children', icon: Baby },
] as const;

export function CrecheApp({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const tabs: BottomNavTab[] = TABS.map((tab) => ({ ...tab, label: t(tab.label) }));
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Navigator slot={slot} routes={crecheRoutes(slot)} />
      </div>
      <BottomNav slot={slot} tabs={tabs} />
    </div>
  );
}
