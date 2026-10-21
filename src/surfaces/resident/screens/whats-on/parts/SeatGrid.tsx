'use client';

/**
 * Screening Room seat map (PRD §8.2, TRD §9.7): one row per seat row plus
 * the accessible spaces, a screen marker on top. A grid with arrow-key
 * navigation (one tab stop, roving focus), `aria-pressed` on each seat and
 * labels like "Row B, seat 3, available".
 */
import { useRef, useState } from 'react';
import { allSeatIds } from '@/domain/events/seats';
import { useT } from '@/i18n/hooks';

function seatRows(): string[][] {
  const rows = new Map<string, string[]>();
  for (const id of allSeatIds()) {
    const row = id.startsWith('AC') ? 'AC' : id.slice(0, 1);
    rows.set(row, [...(rows.get(row) ?? []), id]);
  }
  return [...rows.values()];
}

const ROWS = seatRows();

export function SeatGrid({
  taken,
  selected,
  onToggle,
}: {
  taken: Set<string>;
  selected: string[];
  onToggle: (seatId: string) => void;
}) {
  const t = useT();
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const refs = useRef(new Map<string, HTMLButtonElement>());

  function label(id: string) {
    const state = taken.has(id)
      ? t('events.seat.taken')
      : selected.includes(id)
        ? t('events.seat.selected')
        : t('events.seat.available');
    return id.startsWith('AC')
      ? t('events.seat.accessible', { n: id.slice(2), state })
      : t('events.seat.label', { row: id.slice(0, 1), n: id.slice(1), state });
  }

  function move(e: React.KeyboardEvent, r: number, c: number) {
    const rtl = (e.currentTarget as HTMLElement).closest('[dir="rtl"]') !== null;
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 } as Record<string, number>;
    let [nr, nc] = [r, c];
    if (e.key in step) nc = c + step[e.key]!;
    else if (e.key === 'ArrowDown') nr = r + 1;
    else if (e.key === 'ArrowUp') nr = r - 1;
    else return;
    e.preventDefault();
    nr = Math.max(0, Math.min(ROWS.length - 1, nr));
    nc = Math.max(0, Math.min(ROWS[nr]!.length - 1, nc));
    setFocus([nr, nc]);
    refs.current.get(ROWS[nr]![nc]!)?.focus();
  }

  return (
    <div role="grid" aria-label={t('events.seat.map')} className="flex flex-col gap-1.5">
      <div className="bg-ember text-on-ember font-wide text-eyebrow mb-2 rounded-full py-1 text-center">
        {t('events.seat.screen')}
      </div>
      {ROWS.map((row, r) => (
        <div key={row[0]} role="row" className="flex justify-center gap-1.5">
          {row.map((id, c) => {
            const isTaken = taken.has(id);
            const isSelected = selected.includes(id);
            const focused = focus[0] === r && focus[1] === c;
            return (
              <span key={id} role="gridcell">
                <button
                  ref={(el) => {
                    if (el) refs.current.set(id, el);
                    else refs.current.delete(id);
                  }}
                  type="button"
                  tabIndex={focused ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-disabled={isTaken}
                  aria-label={label(id)}
                  onClick={() => !isTaken && onToggle(id)}
                  onFocus={() => setFocus([r, c])}
                  onKeyDown={(e) => move(e, r, c)}
                  className={`text-body-3 rounded-card-image h-11 w-11 border text-center tabular-nums aria-disabled:cursor-not-allowed aria-disabled:opacity-30 ${
                    isSelected
                      ? 'bg-brand text-on-brand border-brand'
                      : 'border-border-card text-text-body'
                  }`}
                >
                  {id}
                </button>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
