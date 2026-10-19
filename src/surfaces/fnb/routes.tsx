import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import type { VenueKey } from '@/types/dining';
import { FnbHomeScreen } from './screens/FnbHomeScreen';

export function fnbRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
    home: (params) => (
      <FnbHomeScreen slot={slot} initialVenue={params.venue as VenueKey | undefined} />
    ),
  };
}
