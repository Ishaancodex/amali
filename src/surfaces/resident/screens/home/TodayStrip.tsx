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
    <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1">
      {amenities.map((amenity) => {
        const Icon = AMENITY_ICON[amenity.key];
        const status = statusByKey[amenity.key] ?? 'open';
        return (
          <button
            key={amenity.key}
            type="button"
            onClick={() => onOpen(amenity.key)}
            className="rounded-tile border-border-card bg-surface flex w-32 shrink-0 snap-start flex-col items-start gap-2 border-[0.5px] p-3.5 text-start transition-transform active:scale-[0.97]"
          >
            <Icon className="text-brand h-5 w-5" strokeWidth={1.5} />
            <span className="text-label-2 text-text-title">
              {amenityLabel(amenity.key, 'short')}
            </span>
            <span className="flex items-center gap-1.5">
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
