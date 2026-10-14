import { PlaceholderSurface } from '../placeholderSurface';
import type { DeviceSlotId } from '@/types/demo';

export function WhatsAppApp({ slot }: { slot: DeviceSlotId }) {
  return <PlaceholderSurface slot={slot} role="whatsapp" />;
}
