/** Route → component map (TRD §6), mirroring the resident app's pattern. */
import type { RouteComponent } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import { WhatsAppHomeScreen } from './screens/WhatsAppHomeScreen';
import { ThreadScreen } from './screens/ThreadScreen';

export function whatsappRoutes(slot: DeviceSlotId): Record<string, RouteComponent> {
  return {
    home: () => <WhatsAppHomeScreen slot={slot} />,
    thread: () => <ThreadScreen slot={slot} />,
  };
}
