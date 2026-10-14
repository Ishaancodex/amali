import { describe, it, expect } from 'vitest';
import { rng, rngInt, rngPick, rngShuffle, seededId } from '@/lib/random';

describe('lib/random — deterministic, namespaced streams', () => {
  it('the same seed+namespace always produces the same sequence', () => {
    const a = rng('s1', 'ns', 1);
    const b = rng('s1', 'ns', 1);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('a different namespace produces a different sequence from the same seed', () => {
    const a = rng('s1', 'ns-a');
    const b = rng('s1', 'ns-b');
    expect(a()).not.toBe(b());
  });

  it('rngInt stays within [min, max] inclusive', () => {
    const r = rng('s1', 'int');
    for (let i = 0; i < 100; i += 1) {
      const n = rngInt(r, 3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('rngPick only returns items from the input array, deterministically', () => {
    const items = ['a', 'b', 'c'] as const;
    const r1 = rng('s1', 'pick');
    const r2 = rng('s1', 'pick');
    expect(rngPick(r1, items)).toBe(rngPick(r2, items));
  });

  it('rngShuffle is a permutation and deterministic for the same seed', () => {
    const items = [1, 2, 3, 4, 5];
    const a = rngShuffle(rng('s1', 'shuffle'), items);
    const b = rngShuffle(rng('s1', 'shuffle'), items);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(items);
  });

  it('seededId is stable for the same stream position', () => {
    const a = seededId(rng('s1', 'id'), 'res');
    const b = seededId(rng('s1', 'id'), 'res');
    expect(a).toBe(b);
    expect(a.startsWith('res_')).toBe(true);
  });
});
