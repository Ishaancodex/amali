/** Maps a band's live load to the shared RingGauge's colour band: green within ratio, amber near it, red over. */
import type { BandLoad } from '@/domain/creche/capacity';
import type { OccupancyBand } from '@/types/ops';

const NEAR_FULL = 0.85;

export function ratioGauge(load: BandLoad): { fraction: number; band: OccupancyBand } {
  if (load.overBy > 0) return { fraction: 1, band: 'busy' };
  const fraction = load.capacity === 0 ? 0 : load.inRoom / load.capacity;
  return { fraction, band: fraction >= NEAR_FULL ? 'moderate' : 'quiet' };
}
