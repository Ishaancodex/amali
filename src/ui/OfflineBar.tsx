'use client';

/**
 * Offline bar (PRD §11): sticky top bar, stale data labelled with a
 * timestamp frozen at the moment the device went offline.
 */
import { useEffect, useRef } from 'react';
import { WifiOff } from './icons';
import { fmtTime } from '@/lib/time';

export function OfflineBar({ offline, now }: { offline: boolean; now: string }) {
  const frozenAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (offline && !frozenAtRef.current) frozenAtRef.current = now;
    if (!offline) frozenAtRef.current = null;
    // Only capture the instant offline flips on — not every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  if (!offline) return null;

  return (
    <div className="bg-maintenance text-body-3 text-on-brand flex items-center justify-center gap-1.5 px-3 py-1.5">
      <WifiOff className="h-3.5 w-3.5" strokeWidth={1.5} />
      You&apos;re offline. Showing last updated {fmtTime(frozenAtRef.current ?? now)}.
    </div>
  );
}
