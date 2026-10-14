/**
 * Seeded, namespaced randomness (TRD §11). `rng(seed, ...namespace)` combines
 * the seed and namespace into one deterministic stream — changing one part
 * of the seed namespace doesn't shift any other stream's sequence.
 */
import seedrandom from 'seedrandom';

export type Rng = () => number;

export function rng(seed: string, ...namespace: (string | number)[]): Rng {
  const key = [seed, ...namespace.map(String)].join(':');
  return seedrandom(key);
}

/** Integer in [min, max], inclusive. */
export function rngInt(r: Rng, min: number, max: number): number {
  return Math.floor(r() * (max - min + 1)) + min;
}

/** Float in [min, max). */
export function rngFloat(r: Rng, min: number, max: number): number {
  return r() * (max - min) + min;
}

export function rngBool(r: Rng, probabilityTrue = 0.5): boolean {
  return r() < probabilityTrue;
}

export function rngPick<T>(r: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('rngPick: items is empty');
  }
  const value = items[rngInt(r, 0, items.length - 1)];
  if (value === undefined) {
    throw new Error('rngPick: index out of bounds');
  }
  return value;
}

/** Shuffled copy of `items` (Fisher–Yates, deterministic under `r`). */
export function rngShuffle<T>(r: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rngInt(r, 0, i);
    const a = copy[i] as T;
    const b = copy[j] as T;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

/**
 * A short, stable, readable ID derived from the rng stream — used only by
 * seed generation (`src/seed/*`), so the same seed produces byte-identical
 * IDs. Live commands use `lib/ids.ts#id` instead.
 */
export function seededId(r: Rng, prefix: string): string {
  const part = Math.floor(r() * 36 ** 8)
    .toString(36)
    .padStart(8, '0');
  return `${prefix}_${part}`;
}

/** Weighted pick: `weights` must be the same length as `items` and sum > 0. */
export function rngWeightedPick<T>(r: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = r() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) {
      return items[i] as T;
    }
  }
  return items[items.length - 1] as T;
}
