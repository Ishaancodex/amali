'use client';

/**
 * Residents (PRD §8.11): find a resident and act for them. What's shown
 * follows the role — full details for a Community Manager; name, unit
 * and phone for a supervisor; name, unit and a masked phone with a logged
 * "Reveal" for a Call-centre Agent. Booking or cancelling on someone's
 * behalf always needs a reason, and is logged.
 */
import { useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Input } from '@/ui/Input';
import { EmptyState } from '@/ui/EmptyState';
import { Search } from '@/ui/icons';
import { useStore } from '@/store';
import { residentView } from '@/domain/rbac/pii';
import { cn } from '@/lib/cn';
import type { DeviceSlotId } from '@/types/demo';
import { useConsoleActor } from '../useConsoleActor';
import { ResidentPanel } from './parts/ResidentPanel';

const SHOWN = 12;

export function ResidentsScreen({ slot }: { slot: DeviceSlotId }) {
  const { consoleRole } = useConsoleActor(slot);
  const residents = useStore((s) => s.residents);
  const [query, setQuery] = useState('Layla');
  const [selected, setSelected] = useState<string | undefined>();
  if (!consoleRole) return null;

  const q = query.trim().toLowerCase();
  const matches =
    q.length < 2
      ? []
      : Object.values(residents)
          .filter((r) => r.name.toLowerCase().includes(q) || r.unitId.toLowerCase().includes(q))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, SHOWN);

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Residents" />
      <div className="flex min-h-0 flex-1 gap-5 px-6 pb-6">
        <section className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
          <Input
            placeholder="Name or unit"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length === 0 ? (
            <EmptyState icon={Search} message="Type a name or unit." />
          ) : (
            matches.map((r) => {
              const view = residentView(r, consoleRole);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r.id)}
                  className="text-start"
                >
                  <Card className={cn('flex flex-col', selected === r.id && 'border-brand')}>
                    <span className="text-label-2 text-text-title">{view.name}</span>
                    <span className="text-body-3 text-text-muted">
                      {view.unitId}
                      {view.phone ? ` · ${view.phone}` : ''}
                    </span>
                  </Card>
                </button>
              );
            })
          )}
        </section>
        <section className="min-w-0 flex-1 overflow-y-auto">
          {selected && residents[selected] ? (
            <ResidentPanel key={selected} slot={slot} residentId={selected} />
          ) : (
            <EmptyState
              icon={Search}
              message="Choose a resident to see their details and bookings."
            />
          )}
        </section>
      </div>
    </div>
  );
}
