import { PlaceholderSurface } from '../placeholderSurface';
import type { DeviceSlotId } from '@/types/demo';

export function CrecheApp({ slot }: { slot: DeviceSlotId }) {
  return <PlaceholderSurface slot={slot} role="creche" />;
}
