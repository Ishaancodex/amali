'use client';

/**
 * Simulated latency for a screen's first data read (TRD §9.5). Shows a
 * skeleton for 300-600ms (configurable via `demo.simulatedLatencyMs`) only
 * the first time a given key loads this session — revisiting a screen
 * doesn't re-skeleton.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@/store';

export type QueryStatus = 'loading' | 'ready' | 'error';

const seenKeys = new Set<string>();

export function useSimulatedQuery<T>(
  key: string,
  selector: () => T,
): { status: QueryStatus; data: T } {
  const [minMs, maxMs] = useStore((s) => s.demo.simulatedLatencyMs);
  const [status, setStatus] = useState<QueryStatus>(seenKeys.has(key) ? 'ready' : 'loading');

  useEffect(() => {
    if (seenKeys.has(key)) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    const t = setTimeout(() => {
      seenKeys.add(key);
      setStatus('ready');
    }, delay);
    return () => clearTimeout(t);
  }, [key, minMs, maxMs]);

  return { status, data: selector() };
}
