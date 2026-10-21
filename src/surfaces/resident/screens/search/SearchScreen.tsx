'use client';

/** Search (PRD §6.1): amenities, events, announcements — matched by name/location. */
import { useState } from 'react';
import { ScreenShell } from '@/ui/ScreenShell';
import { Rise } from '@/ui/Rise';
import { EmptyState } from '@/ui/EmptyState';
import { Search as SearchIcon, ChevronRight } from '@/ui/icons';
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
    <ScreenShell
      eyebrow={t('resident.search.eyebrow')}
      title={t('resident.nav.search')}
      image="/stock/search.jpg"
    >
      <div className="rounded-tile border-border-card bg-surface flex h-13 items-center gap-3 border px-4">
        <SearchIcon className="text-text-muted h-4 w-4" strokeWidth={1.5} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('resident.search.placeholder')}
          className="text-body-2 text-text-body placeholder:text-text-placeholder w-full bg-transparent outline-none"
        />
      </div>
      {query.trim().length === 0 ? (
        <EmptyState icon={SearchIcon} message={t('resident.search.hint')} />
      ) : results.length === 0 ? (
        <EmptyState icon={SearchIcon} message={t('resident.search.noResults', { query })} />
      ) : (
        <ul className="flex flex-col">
          {results.map((a, i) => {
            const Icon = AMENITY_ICON[a.key];
            return (
              <li key={a.key}>
                <Rise i={i}>
                  <button
                    type="button"
                    onClick={() => push('amenity-detail', { key: a.key })}
                    className="border-border-card flex w-full items-center gap-4 border-b-[0.5px] py-3.5 text-start"
                  >
                    <span className="bg-surface border-border-card text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[0.5px]">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-serif-display text-serif-section text-text-title block">
                        {amenityLabel(a.key)}
                      </span>
                      <span className="text-body-3 text-text-muted block">
                        {amenityLabel(a.key, 'location')}
                      </span>
                    </span>
                    <ChevronRight
                      className="text-text-muted h-4 w-4 rtl:-scale-x-100"
                      strokeWidth={1.5}
                    />
                  </button>
                </Rise>
              </li>
            );
          })}
        </ul>
      )}
    </ScreenShell>
  );
}
