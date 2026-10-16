import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import { CommunicationsScreen } from './screens/CommunicationsScreen';
import { ComposerScreen } from './screens/ComposerScreen';
import { AnnouncementDetailScreen } from './screens/AnnouncementDetailScreen';

export function consoleRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
    home: () => <CommunicationsScreen slot={slot} />,
    composer: () => <ComposerScreen slot={slot} />,
    'announcement-detail': (params) => (
      <AnnouncementDetailScreen slot={slot} announcementId={params.id ?? ''} />
    ),
  };
}
