import { Navigator } from '@/navigation/Navigator';
import { BottomNav } from '@/ui/BottomNav';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';
import { residentRoutes } from './routes';

export function ResidentApp({ slot }: { slot: DeviceSlotId }) {
  const { stack } = useNav(slot);
  return (
    <div className="relative h-full">
      {/* Root tabs pad their bottom edge so nothing hides behind the floating bar. */}
      <Navigator slot={slot} routes={residentRoutes(slot)} rootClassName="pb-(--nav-inset)" />
      <BottomNav slot={slot} floating hidden={stack.length > 1} />
    </div>
  );
}
