import { describe, it, expect } from 'vitest';
import { APP_STATE_KEYS, pickAppState, type RootStore } from '@/store/types';
import { buildSeed } from '@/seed';

describe('store/types — APP_STATE_KEYS', () => {
  it('lists exactly the keys buildSeed produces (no missing, no extra)', () => {
    const seeded = buildSeed('amali-2026', '2026-10-14T13:30:00.000Z');
    expect([...APP_STATE_KEYS].sort()).toEqual(Object.keys(seeded).sort());
  });

  it('pickAppState extracts only data keys, dropping anything else on the object', () => {
    const seeded = buildSeed('amali-2026', '2026-10-14T13:30:00.000Z');
    const withExtra = { ...seeded, someAction: () => {} };
    const picked = pickAppState(withExtra as unknown as RootStore);
    expect(Object.keys(picked).sort()).toEqual([...APP_STATE_KEYS].sort());
    expect('someAction' in picked).toBe(false);
  });
});
