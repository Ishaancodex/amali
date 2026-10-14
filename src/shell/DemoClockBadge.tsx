'use client';

/**
 * The demo clock badge (PRD §4.1): "Wed 14 Oct · 18:42 GST", with +15m/+1h/
 * Next day jumps and a free date-time picker. The `T` key moves forward 15
 * minutes — wired in `shell/shortcuts.ts`.
 */
import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useDemoClock } from '@/scheduler/useDemoClock';
import { toDubai, dubaiDateTimeToIso } from '@/lib/time';
import { format } from 'date-fns';

function toDatetimeLocalValue(iso: string): string {
  return format(toDubai(iso), "yyyy-MM-dd'T'HH:mm");
}

export function DemoClockBadge() {
  const [open, setOpen] = useState(false);
  const { now, jump, setNow } = useDemoClock();

  function handlePickerChange(value: string) {
    const [dateKey, hhmm] = value.split('T');
    if (!dateKey || !hhmm) return;
    setNow(dubaiDateTimeToIso(dateKey, hhmm));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="bg-shell-stage-raised text-body-3 text-shell-stage-text hover:text-shell-stage-active flex items-center gap-1.5 rounded-full px-3 py-1 tabular-nums transition-colors"
      >
        <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
        {format(toDubai(now), 'EEE d MMM')} · {format(toDubai(now), 'HH:mm')} GST
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="rounded-card border-shell-stage-border bg-shell-stage-raised absolute start-0 top-full z-40 mt-2 w-64 space-y-2 border p-3 shadow-xl">
            <div className="flex gap-2">
              {(['+15m', '+1h', 'next_day'] as const).map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => jump(j)}
                  className="rounded-button border-shell-stage-border text-label-3 text-shell-stage-active hover:bg-shell-stage-border flex-1 border px-2 py-1.5 transition-colors"
                >
                  {j === 'next_day' ? 'Next day' : j}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(now)}
              onChange={(e) => handlePickerChange(e.target.value)}
              className="rounded-input border-shell-stage-border bg-shell-stage text-body-3 text-shell-stage-active w-full border px-2 py-1.5"
            />
          </div>
        </>
      )}
    </div>
  );
}
