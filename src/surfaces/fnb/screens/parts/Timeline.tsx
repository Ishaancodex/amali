'use client';

/**
 * The timeline (PRD §8.4, M24): rows are tables, columns 15-minute steps.
 * A block shows the name, party size and icons (occasion, allergy in red).
 * Drag a block up or down onto another table to reassign it — on drop it
 * snaps into its new row with a spring, or springs back if the table is
 * taken. Teppanyaki is one shared counter, so parties stack in lanes.
 */
import { useRef } from 'react';
import { motion } from 'motion/react';
import { Gift, CircleAlert } from '@/ui/icons';
import { fnbTimeline as G } from '@/design/tokens';
import { spring } from '@/design/motion';
import { useStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { minutesBetween, addMinutesIso } from '@/lib/time';
import { useErrorText, useFmt, useT } from '@/i18n/hooks';
import { rules } from '@/config/rules';
import { cn } from '@/lib/cn';
import type { Reservation, ServicePeriod, VenueKey } from '@/types/dining';
import type { DeviceSlotId } from '@/types/demo';
import { useService, hasAllergy } from '../../useService';

const STEP = rules.dining.restaurant.startGridMinutes;

const BLOCK_STYLE: Partial<Record<Reservation['state'], string>> = {
  confirmed: 'bg-brand-tint text-brand border-brand',
  seated: 'bg-brand text-on-brand border-brand',
  completed: 'bg-surface text-text-muted border-border-card',
  no_show: 'bg-danger/10 text-danger border-danger',
};

/** Greedy lanes so overlapping counter parties don't sit on top of each other. */
function lanes(list: Reservation[]): Map<string, number> {
  const ends: string[] = [];
  const out = new Map<string, number>();
  for (const r of list) {
    let lane = ends.findIndex((end) => end <= r.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = r.end;
    out.set(r.id, lane);
  }
  return out;
}

export function Timeline({
  slot,
  venue,
  period,
  onOpen,
}: {
  slot: DeviceSlotId;
  venue: VenueKey;
  period: ServicePeriod | undefined;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const errorText = useErrorText();
  const { window, tables, inService, now } = useService(venue, period);
  const residents = useStore((s) => s.residents);
  const dispatch = useStore((s) => s.dispatch);
  const actorId = useStore((s) => s.demo.devices[slot]?.actorId ?? '');
  const role = useStore((s) => s.staff[actorId]?.role);
  const pushToast = useUiStore((s) => s.pushToast);

  const visible = inService.filter((r) =>
    ['confirmed', 'seated', 'completed', 'no_show'].includes(r.state),
  );
  const columns = Math.ceil(minutesBetween(window.start, window.end) / STEP);
  const x = (iso: string) => (minutesBetween(window.start, iso) / STEP) * G.colWidth;
  const laneOf = lanes(visible);
  const laneCount =
    venue === 'teppanyaki' ? Math.max(1, ...[...laneOf.values()].map((l) => l + 1)) : 1;
  const rowHeight = G.rowHeight * laneCount;

  // The device frame is CSS-scaled, so drag offsets in screen pixels don't map to row heights —
  // find the row under the pointer by its on-screen rectangle instead.
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  function drop(r: Reservation, fromRow: number, clientY: number) {
    const toRow = rowRefs.current.findIndex((el) => {
      const rect = el?.getBoundingClientRect();
      return !!rect && rect.top <= clientY && clientY < rect.bottom;
    });
    const target = tables[toRow];
    if (!target || toRow === fromRow || venue === 'teppanyaki') return;
    const result = dispatch(
      'dining.moveTables',
      { reservationId: r.id, tableIds: [target.id] },
      { kind: 'staff', id: actorId, role },
    );
    pushToast(
      slot,
      result.ok
        ? t('fnb.movedTo', { table: target.id, zone: t(`dining.zone.${target.zone}`) })
        : errorText(result.error),
      result.ok ? 'success' : 'error',
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: G.labelWidth + columns * G.colWidth }}>
        <div
          className="text-body-3 text-text-placeholder flex"
          style={{ paddingInlineStart: G.labelWidth }}
        >
          {Array.from({ length: columns }, (_, i) => (
            <span key={i} className="shrink-0" style={{ width: G.colWidth }}>
              {i % 2 === 0 ? fmt.time(addMinutesIso(window.start, i * STEP)) : ''}
            </span>
          ))}
        </div>
        {tables.map((table, row) => (
          <div
            key={table.id}
            ref={(el) => {
              rowRefs.current[row] = el;
            }}
            className="border-border-card relative flex border-t-[0.5px]"
            style={{ height: rowHeight }}
          >
            <div
              className="text-label-3 text-text-title flex shrink-0 flex-col justify-center"
              style={{ width: G.labelWidth }}
            >
              {table.id}
              <span className="text-body-3 text-text-muted capitalize">
                {table.seats} · {table.zone}
              </span>
            </div>
            {visible
              .filter((r) => r.tableIds.includes(table.id))
              .map((r) => {
                const primary = r.tableIds[0] === table.id;
                const draggable = primary && r.state === 'confirmed' && venue !== 'teppanyaki';
                return (
                  <motion.button
                    key={`${r.id}:${table.id}`}
                    layoutId={`${slot}:res:${r.id}:${primary ? 'p' : table.id}`}
                    type="button"
                    drag={draggable ? 'y' : false}
                    dragSnapToOrigin
                    dragElastic={0.2}
                    dragMomentum={false}
                    whileDrag={{ scale: 1.03, zIndex: 20 }}
                    transition={spring.snappy}
                    onDragEnd={(event) => drop(r, row, 'clientY' in event ? event.clientY : -1)}
                    onClick={() => onOpen(r.id)}
                    className={cn(
                      'rounded-tag text-label-3 absolute flex items-center gap-1 overflow-hidden border px-2 text-start whitespace-nowrap',
                      BLOCK_STYLE[r.state],
                      r.noShowFlaggedAt && r.state === 'confirmed' && 'border-danger',
                      draggable && 'cursor-grab active:cursor-grabbing',
                    )}
                    style={{
                      insetInlineStart: G.labelWidth + x(r.start),
                      top:
                        (laneOf.get(r.id) ?? 0) * G.rowHeight * (venue === 'teppanyaki' ? 1 : 0) +
                        G.blockInset,
                      width: Math.max(G.colWidth, x(r.end) - x(r.start)) - G.blockInset,
                      height: G.rowHeight - G.blockInset * 2,
                    }}
                  >
                    {hasAllergy(r.dietary) && (
                      <CircleAlert className="text-danger h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    )}
                    {r.occasion && <Gift className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />}
                    <span className="truncate">
                      {r.walkIn
                        ? t('fnb.walkIn')
                        : (residents[r.residentId]?.name.split(' ')[0] ?? t('fnb.guest'))}{' '}
                      · {r.partySize}
                    </span>
                  </motion.button>
                );
              })}
          </div>
        ))}
        {now >= window.start && now < window.end && (
          <div
            className="bg-danger pointer-events-none absolute top-0 bottom-0 w-px"
            style={{ insetInlineStart: G.labelWidth + x(now) }}
          />
        )}
      </div>
    </div>
  );
}
