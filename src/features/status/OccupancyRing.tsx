/**
 * Live occupancy ring (PRD §8.5, M17): a ring gauge plus "Quiet / Moderate
 * / Busy" and a count.
 */
import { RingGauge } from '@/ui/RingGauge';
import type { OccupancyEstimate } from '@/domain/ops/occupancyEstimate';
import { useT } from '@/i18n/hooks';

export function OccupancyRing({ estimate }: { estimate: OccupancyEstimate }) {
  const t = useT();
  return (
    <div className="flex items-center gap-4">
      <RingGauge fraction={estimate.fraction} band={estimate.band} size={64} strokeWidth={6}>
        <span className="text-label-2 text-text-title tabular-nums">{estimate.count}</span>
      </RingGauge>
      <div>
        <p className="text-label-2 text-text-title">{t(`ui.occupancy.${estimate.band}`)}</p>
        <p className="text-body-3 text-text-muted">
          {t('ui.occupancy.countOf', { count: estimate.count, capacity: estimate.capacity })}
        </p>
      </div>
    </div>
  );
}
