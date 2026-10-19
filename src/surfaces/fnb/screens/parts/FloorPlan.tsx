'use client';

/**
 * Floor plan (PRD §8.4): every table with its live state — Free,
 * Reserved soon (within 30 min), Seated, Bill requested, Turning. Tap a
 * booked table to act on it, a free one to seat a walk-in.
 */
import { CircleAlert } from '@/ui/icons';
import { useStore } from '@/store';
import { rules } from '@/config/rules';
import { tableState, type TableState } from '@/domain/dining/service';
import { cn } from '@/lib/cn';
import type { ServicePeriod, VenueKey } from '@/types/dining';
import { useService, hasAllergy } from '../../useService';

const STATE: Record<TableState, { label: string; className: string }> = {
  free: { label: 'Free', className: 'border-border-card bg-surface text-text-muted' },
  soon: { label: 'Reserved soon', className: 'border-warning bg-warning/10 text-warning' },
  seated: { label: 'Seated', className: 'border-brand bg-brand text-on-brand' },
  bill: { label: 'Bill requested', className: 'border-info bg-info/15 text-info' },
  turning: { label: 'Turning', className: 'border-maintenance bg-maintenance/15 text-maintenance' },
};

export function FloorPlan({
  venue,
  period,
  onOpen,
  onWalkIn,
}: {
  venue: VenueKey;
  period: ServicePeriod | undefined;
  onOpen: (id: string) => void;
  onWalkIn: () => void;
}) {
  const { tables, all, now } = useService(venue, period);
  const residents = useStore((s) => s.residents);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {(Object.keys(STATE) as TableState[]).map((k) => (
          <span key={k} className="text-body-3 text-text-muted flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded-full border', STATE[k].className)} />
            {STATE[k].label}
          </span>
        ))}
      </div>
      <div className="border-border-card bg-surface rounded-card relative min-h-96 flex-1 border-[0.5px]">
        {venue === 'restaurant' && (
          <>
            <span className="text-tag text-text-placeholder absolute start-4 top-3">Indoor</span>
            <span className="text-tag text-text-placeholder absolute end-4 top-3">Terrace</span>
            <span className="text-tag text-text-placeholder absolute start-4 bottom-3">
              Canal view
            </span>
          </>
        )}
        {tables.map((t) => {
          const { state, reservation: r } = tableState(t, all, now, rules.dining.floor);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => (r ? onOpen(r.id) : onWalkIn())}
              className={cn(
                'rounded-card absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border px-2 py-1.5 rtl:translate-x-1/2',
                t.seats >= 6 ? 'min-w-28' : t.seats >= 4 ? 'min-w-22' : 'min-w-16',
                STATE[state].className,
              )}
              style={{ insetInlineStart: `${t.x}%`, top: `${t.y}%` }}
            >
              <span className="text-label-2 flex items-center gap-1">
                {t.id}
                {r && hasAllergy(r.dietary) && (
                  <CircleAlert className="text-danger h-3.5 w-3.5" strokeWidth={2} />
                )}
              </span>
              <span className="text-body-3">
                {r
                  ? `${r.walkIn ? 'Walk-in' : (residents[r.residentId]?.name.split(' ')[0] ?? 'Guest')} · ${r.partySize}`
                  : `${t.seats} seats`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
