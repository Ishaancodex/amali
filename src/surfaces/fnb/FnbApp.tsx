import { Navigator } from '@/navigation/Navigator';
import type { DeviceSlotId } from '@/types/demo';
import { fnbRoutes } from './routes';

export function FnbApp({ slot }: { slot: DeviceSlotId }) {
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Navigator slot={slot} routes={fnbRoutes(slot)} />
      </div>
    </div>
  );
}
