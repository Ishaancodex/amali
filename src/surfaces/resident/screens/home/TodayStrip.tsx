/** "Today at Amali" status strip (PRD §9.3): tapping a pill opens the amenity. */
import { AMENITY_ICON } from '@/features/status/amenityIcons';
import type { Amenity, AmenityStatus } from '@/types/amenity';
import { useAmenityLabel, useT } from '@/i18n/hooks';

const STATUS_DOT: Record<AmenityStatus, string> = {
  open: 'bg-success',
  limited: 'bg-warning',
  closed: 'bg-text-muted',
  maintenance: 'bg-maintenance',
  emergency: 'bg-danger',
};

export function TodayStrip({
  amenities,
  statusByKey,
  onOpen,
}: {
  amenities: Amenity[];
  statusByKey: Record<string, AmenityStatus>;
  onOpen: (key: string) => void;
}) {
  const t = useT();
  const amenityLabel = useAmenityLabel();
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1">
      {amenities.map((amenity) => {
        const Icon = AMENITY_ICON[amenity.key];
        const status = statusByKey[amenity.key] ?? 'open';
        return (
          <button
            key={amenity.key}
            type="button"
            onClick={() => onOpen(amenity.key)}
            className="rounded-tag border-border-card bg-surface flex shrink-0 items-center gap-2 border-[0.5px] py-2 ps-2.5 pe-3"
          >
            <Icon className="text-brand h-4 w-4" strokeWidth={1.5} />
            <span className="text-label-3 text-text-body">
              {amenityLabel(amenity.key, 'short')}
            </span>
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
              <span className="text-body-3 text-text-muted">
                {t(`resident.home.statusShort.${status}`)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
