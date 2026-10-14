import { Signal, Wifi, BatteryFull } from 'lucide-react';
import { fmtTime } from '@/lib/time';

export function StatusBar({ now }: { now: string }) {
  return (
    <div className="text-text-body flex shrink-0 items-center justify-between px-6 pt-3 pb-1">
      <span className="text-label-3 tabular-nums">{fmtTime(now)}</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3.5 w-3.5" strokeWidth={1.5} />
        <Wifi className="h-3.5 w-3.5" strokeWidth={1.5} />
        <BatteryFull className="h-4 w-4" strokeWidth={1.5} />
      </div>
    </div>
  );
}
