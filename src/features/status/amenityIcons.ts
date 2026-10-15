import {
  Target,
  Film,
  Music,
  Baby,
  UtensilsCrossed,
  Waves,
  Dumbbell,
  type LucideIcon,
} from '@/ui/icons';
import type { AmenityKey } from '@/types/amenity';

export const AMENITY_ICON: Record<AmenityKey, LucideIcon> = {
  padel: Target,
  screening: Film,
  music: Music,
  creche: Baby,
  dining: UtensilsCrossed,
  pool: Waves,
  gym: Dumbbell,
};
