'use client';

/** Search (PRD §6.1): amenities, events, announcements. Events/announcements
 * have no data yet (P4/P5) — search matches amenities by name/location for now. */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { EmptyState } from '@/ui/EmptyState';
import { Search as SearchIcon } from '@/ui/icons';
import { AMENITY_ICON } from '@/features/status/amenityIcons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';
import { useAmenityLabel, useT } from '@/i18n/hooks';

export function SearchScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const amenityLabel = useAmenityLabel();
  const [query, setQuery] = useState('');
  const amenitiesRecord = useStore((s) => s.amenities);
  const amenities = Object.values(amenitiesRecord);
  const { push } = useNav(slot);

  const results =
    query.trim().length === 0
      ? []
      : amenities.filter((a) =>
          [amenityLabel(a.key), amenityLabel(a.key, 'location'), a.name, a.location].some((text) =>
            text.toLowerCase().includes(query.toLowerCase()),
          ),
        );

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('resident.nav.search')} />
      <div className="px-4 pb-3">
        <div className="rounded-input border-border-card bg-surface flex items-center gap-2 border px-3 py-2.5">
          <SearchIcon className="text-text-muted h-4 w-4" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('resident.search.placeholder')}
            className="text-body-2 text-text-body placeholder:text-text-placeholder w-full bg-transparent outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {query.trim().length === 0 ? (
          <EmptyState icon={SearchIcon} message={t('resident.search.hint')} />
        ) : results.length === 0 ? (
          <EmptyState icon={SearchIcon} message={t('resident.search.noResults', { query })} />
        ) : (
          <ul className="divide-border-card flex flex-col divide-y">
            {results.map((a) => {
              const Icon = AMENITY_ICON[a.key];
              return (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => push('amenity-detail', { key: a.key })}
                    className="flex w-full items-center gap-3 py-3 text-start"
                  >
                    <Icon className="text-brand h-5 w-5" strokeWidth={1.5} />
                    <div>
                      <p className="text-label-2 text-text-body">{amenityLabel(a.key)}</p>
                      <p className="text-body-3 text-text-muted">
                        {amenityLabel(a.key, 'location')}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
