'use client';

import { useDemoClock } from '@/scheduler/useDemoClock';
import { toDubai, dubaiDateTimeToIso } from '@/lib/time';
import { format } from 'date-fns';

function toDatetimeLocalValue(iso: string): string {
  return format(toDubai(iso), "yyyy-MM-dd'T'HH:mm");
}

export function ClockControls() {
  const { now, jump, setNow, isLeader } = useDemoClock();

  function handlePickerChange(value: string) {
    const [dateKey, hhmm] = value.split('T');
    if (!dateKey || !hhmm) return;
    setNow(dubaiDateTimeToIso(dateKey, hhmm));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-label-2 text-shell-stage-active">Demo clock</h3>
        {!isLeader && <span className="text-body-3 text-shell-notes-label">follower tab</span>}
      </div>
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
  );
}
