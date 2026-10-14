import { PlaceholderSurface } from '../placeholderSurface';
import type { DeviceSlotId } from '@/types/demo';

export function ConsoleApp({ slot }: { slot: DeviceSlotId }) {
  return <PlaceholderSurface slot={slot} role="console" />;
}
