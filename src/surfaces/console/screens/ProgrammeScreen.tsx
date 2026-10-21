'use client';

/**
 * The programme calendar (PRD §8.6): every recurring series' occurrences
 * on a month grid (tap one to edit it — this / following / all), the
 * rolling year view with seasons as shaded bands, and the series list
 * with anything needing attention (season-hours clashes, public holidays).
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Button } from '@/ui/Button';
import { Plus } from '@/ui/icons';
import { CalendarYear } from '@/ui/Calendar/Year';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import { seasonBands } from '@/store/selectors/programme';
import { cn } from '@/lib/cn';
import type { DeviceSlotId } from '@/types/demo';
import { ProgrammeMonth } from './parts/ProgrammeMonth';
import { SeriesList } from './parts/SeriesList';
import { OccurrenceSheet } from './parts/OccurrenceSheet';
import { SeasonSheet } from './parts/SeasonSheet';
import { useT } from '@/i18n/hooks';

export function ProgrammeScreen({ slot }: { slot: DeviceSlotId }) {
  const t = useT();
  const { pop, push } = useNav(slot);
  const seasons = useStore((s) => s.seasons);
  const now = useStore((s) => s.demo.clock.now);
  const [view, setView] = useState<'month' | 'year'>('month');
  const [open, setOpen] = useState<{ programmeId: string; originalStart: string } | undefined>();
  const [seasonOpen, setSeasonOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <TopBar title={t('console.programme.title')} onBack={pop} />
      <div className="flex min-h-0 flex-1 gap-5 overflow-y-auto px-6 pb-6">
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            {(['month', 'year'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded-tag text-label-3 px-3 py-1.5',
                  view === v ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand',
                )}
              >
                {t(`events.view.${v}`)}
              </button>
            ))}
            <div className="ms-auto flex gap-2">
              <Button variant="secondary" onClick={() => setSeasonOpen(true)}>
                {t('console.programme.newSeason')}
              </Button>
              <Button onClick={() => push('programme-edit')}>
                <Plus className="me-1 inline h-4 w-4" strokeWidth={1.5} />
                {t('console.programme.newSeries')}
              </Button>
            </div>
          </div>
          {view === 'month' ? (
            <ProgrammeMonth
              onOpen={(programmeId, originalStart) => setOpen({ programmeId, originalStart })}
            />
          ) : (
            <CalendarYear now={now} rolling bands={seasonBands(seasons)} />
          )}
        </section>
        <aside className="w-80 shrink-0">
          <SeriesList slot={slot} />
        </aside>
      </div>
      <OccurrenceSheet slot={slot} target={open} onClose={() => setOpen(undefined)} />
      <SeasonSheet slot={slot} open={seasonOpen} onClose={() => setSeasonOpen(false)} />
    </div>
  );
}
