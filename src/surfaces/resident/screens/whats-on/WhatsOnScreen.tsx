'use client';

/**
 * What's On (PRD §6.1): List view (this week) | Calendar view (month/year).
 * No events exist yet (Phase P4) — PRD §11 explicitly calls out "0 events
 * this week" as an edge case to handle gracefully, which this does.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { EmptyState } from '@/ui/EmptyState';
import { CalendarMonth } from '@/ui/Calendar/Month';
import { CalendarYear } from '@/ui/Calendar/Year';
import { CalendarDays } from '@/ui/icons';
import { useStore } from '@/store';
import { useNav } from '@/navigation/useNav';
import type { DeviceSlotId } from '@/types/demo';

type ViewTab = 'list' | 'month' | 'year';
const TABS: { id: ViewTab; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export function WhatsOnScreen({ slot }: { slot: DeviceSlotId }) {
  const { pop } = useNav(slot);
  const now = useStore((s) => s.demo.clock.now);
  const [tab, setTab] = useState<ViewTab>('list');

  return (
    <div className="flex h-full flex-col">
      <TopBar title="What's On" onBack={pop} />
      <div className="flex gap-1 px-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`rounded-tag text-label-3 px-3 py-1.5 transition-colors ${
              tab === t.id ? 'bg-brand text-on-brand' : 'bg-brand-tint text-brand'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {tab === 'list' && (
          <EmptyState icon={CalendarDays} message="Nothing on this week yet. Check back soon." />
        )}
        {tab === 'month' && <CalendarMonth now={now} />}
        {tab === 'year' && <CalendarYear now={now} />}
      </div>
    </div>
  );
}
