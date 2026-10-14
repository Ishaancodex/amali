import { PlaceholderSurface } from '../placeholderSurface';
import type { DeviceSlotId } from '@/types/demo';

export function ResidentApp({ slot }: { slot: DeviceSlotId }) {
  return <PlaceholderSurface slot={slot} role="resident" />;
}
