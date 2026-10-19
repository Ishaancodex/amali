import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import { RoomBoardScreen } from './screens/RoomBoardScreen';
import { CheckScreen } from './screens/CheckScreen';
import { SessionsScreen } from './screens/SessionsScreen';
import { IncidentsScreen } from './screens/IncidentsScreen';
import { LogIncidentScreen } from './screens/LogIncidentScreen';
import { ChildrenScreen } from './screens/ChildrenScreen';

export function crecheRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
    home: () => <RoomBoardScreen slot={slot} />,
    check: (params) => (
      <CheckScreen slot={slot} childId={params.child} guardianId={params.guardian} />
    ),
    sessions: () => <SessionsScreen slot={slot} />,
    incidents: () => <IncidentsScreen slot={slot} />,
    'log-incident': (params) => <LogIncidentScreen slot={slot} childId={params.child} />,
    children: () => <ChildrenScreen slot={slot} />,
  };
}
