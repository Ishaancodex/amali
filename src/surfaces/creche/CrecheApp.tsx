import { Navigator } from '@/navigation/Navigator';
import { BottomNav, type BottomNavTab } from '@/ui/BottomNav';
import { LayoutGrid, LogIn, CalendarDays, CircleAlert, Baby } from '@/ui/icons';
import type { DeviceSlotId } from '@/types/demo';
import { crecheRoutes } from './routes';

/** PRD §6.3: Room board · Check-in/out · Today's sessions · Incidents · Children directory. */
const TABS: BottomNavTab[] = [
  { route: 'home', label: 'Board', icon: LayoutGrid },
  { route: 'check', label: 'Check-in', icon: LogIn },
  { route: 'sessions', label: 'Sessions', icon: CalendarDays },
  { route: 'incidents', label: 'Incidents', icon: CircleAlert },
  { route: 'children', label: 'Children', icon: Baby },
];

export function CrecheApp({ slot }: { slot: DeviceSlotId }) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Navigator slot={slot} routes={crecheRoutes(slot)} />
      </div>
      <BottomNav slot={slot} tabs={TABS} />
    </div>
  );
}
