/**
 * Simulated network latency (TRD §9.5). Every screen's first data read goes
 * through `withLatency` / `useSimulatedQuery` so loading skeletons show for
 * a believable 300–600ms, configurable via `config/features.ts` and
 * overridable to 0 in tests.
 */

export interface LatencyRange {
  minMs: number;
  maxMs: number;
}

export const DEFAULT_LATENCY: LatencyRange = { minMs: 300, maxMs: 600 };

function randomInRange({ minMs, maxMs }: LatencyRange): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export async function withLatency<T>(
  fn: () => T | Promise<T>,
  range: LatencyRange = DEFAULT_LATENCY,
): Promise<T> {
  if (range.maxMs <= 0) {
    return fn();
  }
  await new Promise((resolve) => setTimeout(resolve, randomInRange(range)));
  return fn();
}
