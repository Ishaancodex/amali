import { PlaceholderSurface } from '../placeholderSurface';
import type { DeviceSlotId } from '@/types/demo';

export function FnbApp({ slot }: { slot: DeviceSlotId }) {
  return <PlaceholderSurface slot={slot} role="fnb" />;
}
