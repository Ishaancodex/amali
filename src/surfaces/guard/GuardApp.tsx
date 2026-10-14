import { PlaceholderSurface } from '../placeholderSurface';
import type { DeviceSlotId } from '@/types/demo';

export function GuardApp({ slot }: { slot: DeviceSlotId }) {
  return <PlaceholderSurface slot={slot} role="guard" />;
}
