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
import { useSimulatedQuery } from '@/lib/useSimulatedQuery';
import { useNav } from '@/navigation/useNav';
import { selectCurrentStatus } from '@/store/selectors/amenities';
import { AMENITY_ICON } from '@/features/status/amenityIcons';
import { rules } from '@/config/rules';
import type { DeviceSlotId } from '@/types/demo';
import type { AmenityKey } from '@/types/amenity';
import { useAmenityLabel, useFmt, useT } from '@/i18n/hooks';
import type { T } from '@/i18n/hooks';
import type { Fmt } from '@/i18n/format';

/** Where each bookable amenity's Book button goes. */
const BOOK_ROUTE: Partial<Record<AmenityKey, string>> = {
  padel: 'padel-book',
  screening: 'whats-on',
  music: 'whats-on',
  creche: 'creche-book',
  dining: 'dining-book',
};

function hoursLineFor(key: AmenityKey, t: T): string {
  switch (key) {
    case 'padel':
      return t('resident.amenities.hours.daily', rules.padel.operatingHours);
    case 'pool':
      return `${t('resident.amenities.hours.daily', rules.pool.hours)} · ${rules.pool.minAge}+`;
    case 'gym':
      return t('resident.amenities.hours.allDay');
    case 'creche':
      return `${rules.creche.sessions.morning.start} – ${rules.creche.sessions.afternoon.end}`;
    case 'screening':
    case 'music':
      return t('resident.amenities.hours.programme');
    case 'dining':
      return t('resident.amenities.hours.meals');
  }
}

function priceLineFor(key: AmenityKey, t: T, fmt: Fmt): string | undefined {
  switch (key) {
    case 'padel':
      return t('resident.amenities.price.guests', { amount: fmt.aed(rules.padel.guestFeeFils) });
    case 'dining':
      return t('resident.amenities.price.teppanyaki', {
        amount: fmt.aed(rules.dining.teppanyaki.pricePerPersonFils),
      });
    default:
      return undefined;
  }
}

export function AmenitiesListScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const fmt = useFmt();
  const amenityLabel = useAmenityLabel();
  const [query, setQuery] = useState('');
  const amenities = useStore((s) => s.amenities);
  const amenityStatus = useStore((s) => s.amenityStatus);
  const now = useStore((s) => s.demo.clock.now);
  const { push, pop } = useNav(slot);

  const { status, data } = useSimulatedQuery('amenities-list', () => Object.values(amenities));
  const q = query.trim().toLowerCase();
  const filtered = data.filter((a) =>
    [amenityLabel(a.key), a.name].some((name) => name.toLowerCase().includes(q)),
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('resident.home.quick.amenities')} onBack={pop} />
      <div className="px-4 pb-3">
        <div className="rounded-input border-border-card bg-surface flex items-center gap-2 border px-3 py-2.5">
          <SearchIcon className="text-text-muted h-4 w-4" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('resident.amenities.search')}
            className="text-body-2 text-text-body placeholder:text-text-placeholder w-full bg-transparent outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 px-4 pb-6">
          {status === 'loading' ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[220px]" />)
          ) : filtered.length === 0 ? (
            <EmptyState icon={SearchIcon} message={t('resident.amenities.noMatch', { query })} />
          ) : (
            filtered.map((amenity) => {
              const amenityStatusValue = selectCurrentStatus({ amenityStatus }, amenity.key, now);
              const bookRoute = BOOK_ROUTE[amenity.key];
              return (
                <AmenityCard
                  key={amenity.key}
                  image={amenity.image}
                  icon={AMENITY_ICON[amenity.key]}
                  title={amenityLabel(amenity.key)}
                  hoursLine={hoursLineFor(amenity.key, t)}
                  priceLine={priceLineFor(amenity.key, t, fmt)}
                  status={amenityStatusValue}
                  bookable={!!bookRoute}
                  onOpen={() => push('amenity-detail', { key: amenity.key })}
                  onBook={bookRoute ? () => push(bookRoute) : undefined}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
