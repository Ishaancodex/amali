'use client';

/** Amenities list (PRD §6.1; layout reference: Figma "Amenities" frame —
 * a single full-width card list with a search field, not a grid). Padel/
 * Screening/Music/Creche/Dining are bookable from P3 onward — P2 shows
 * rules/status only. Pool/Gym are read-only here and always. */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { AmenityCard } from '@/ui/AmenityCard';
import { Skeleton } from '@/ui/Skeleton';
import { EmptyState } from '@/ui/EmptyState';
import { Search as SearchIcon } from '@/ui/icons';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import { AMENITY_ICON } from '@/features/status/amenityIcons';
import { rules } from '@/config/rules';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';

const BOOKABLE: readonly AmenityKey[] = ['padel', 'screening', 'music', 'creche', 'dining'];

function hoursLineFor(key: AmenityKey): string {
  switch (key) {
    case 'padel':
      return `Daily ${rules.padel.operatingHours.open} – ${rules.padel.operatingHours.close}`;
    case 'pool':
      return `Daily ${rules.pool.hours.open} – ${rules.pool.hours.close} · 18+`;
    case 'gym':
      return 'Open 24 hours';
    case 'creche':
      return `${rules.creche.sessions.morning.start} – ${rules.creche.sessions.afternoon.end}`;
    case 'screening':
    case 'music':
      return 'See programme for showtimes';
    case 'dining':
      return 'Breakfast · Lunch · Dinner';
  }
}

function priceLineFor(key: AmenityKey): string | undefined {
  switch (key) {
    case 'padel':
      return `Guests AED ${rules.padel.guestFeeFils / 100} each`;
    case 'dining':
      return 'Teppanyaki from AED 350pp';
    default:
      return undefined;
  }
}

export function AmenitiesListScreen({ slot }: { slot: DeviceSlotId }) {
  const [query, setQuery] = useState('');
  const amenities = useStore((s) => s.amenities);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const now = useStore((s) => s.demo.clock.now);
  const { push, pop } = useNav(slot);
  const pushToast = useUiStore((s) => s.pushToast);

  const { status, data } = useSimulatedQuery('amenities-list', () => Object.values(amenities));
  const filtered = data.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Amenities" onBack={pop} />
      <div className="px-4 pb-3">
        <div className="rounded-input border-border-card bg-surface flex items-center gap-2 border px-3 py-2.5">
          <SearchIcon className="text-text-muted h-4 w-4" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search amenities"
            className="text-body-2 text-text-body placeholder:text-text-placeholder w-full bg-transparent outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pb-6">
          {status === 'loading' ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[220px]" />)
          ) : filtered.length === 0 ? (
            <EmptyState icon={SearchIcon} message={`No amenities match "${query}".`} />
          ) : (
            filtered.map((amenity) => {
              const amenityStatusValue = selectCurrentStatus({ amenityStatus }, amenity.key, now);
              const bookable = BOOKABLE.includes(amenity.key);
              return (
                <AmenityCard
                  key={amenity.key}
                  image={amenity.image}
                  icon={AMENITY_ICON[amenity.key]}
                  title={amenity.name}
                  hoursLine={hoursLineFor(amenity.key)}
                  priceLine={priceLineFor(amenity.key)}
                  status={amenityStatusValue}
                  bookable={bookable}
                  onOpen={() => push('amenity-detail', { key: amenity.key })}
                  onBook={
                    bookable
                      ? () =>
                          pushToast(slot, 'Booking opens in a later phase (TRD §13).', 'neutral')
                      : undefined
                  }
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
