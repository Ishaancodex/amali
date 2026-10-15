import { Navigator } from '@/navigation/Navigator';
import { BottomNav } from '@/ui/BottomNav';
import type { DeviceSlotId } from '@/types/demo';
import { residentRoutes } from './routes';

export function ResidentApp({ slot }: { slot: DeviceSlotId }) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Navigator slot={slot} routes={residentRoutes(slot)} />
      </div>
      <BottomNav slot={slot} />
    </div>
  );
}
