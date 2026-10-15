/**
 * Live occupancy ring (PRD §8.5, M17): a ring gauge plus "Quiet / Moderate
 * / Busy" and a count.
 */
import { RingGauge } from '@/ui/RingGauge';
import type { OccupancyEstimate } from '@/domain/ops/occupancyEstimate';

const BAND_LABEL = { quiet: 'Quiet', moderate: 'Moderate', busy: 'Busy' } as const;

export function OccupancyRing({ estimate }: { estimate: OccupancyEstimate }) {
  return (
    <div className="flex items-center gap-4">
      <RingGauge fraction={estimate.fraction} band={estimate.band} size={64} strokeWidth={6}>
        <span className="text-label-2 text-text-title tabular-nums">{estimate.count}</span>
      </RingGauge>
      <div>
        <p className="text-label-2 text-text-title">{BAND_LABEL[estimate.band]}</p>
        <p className="text-body-3 text-text-muted">
          {estimate.count} of {estimate.capacity}
        </p>
      </div>
    </div>
  );
}
