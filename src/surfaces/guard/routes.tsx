import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import { GuardHomeScreen } from './screens/GuardHomeScreen';
import { RaiseIncidentScreen } from './screens/RaiseIncidentScreen';

export function guardRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
    home: () => <GuardHomeScreen slot={slot} />,
    'raise-incident': () => <RaiseIncidentScreen slot={slot} />,
  };
}
