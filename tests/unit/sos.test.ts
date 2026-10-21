import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import '@/store/commands/registerAll';
import { buildSeed } from '@/seed';
import { PERSONA_IDS } from '@/seed/personaIds';
import { selectNextPadelBooking } from '@/store/selectors/bookings';

const NOW = '2026-10-14T13:30:00.000Z';

describe('sos.raise', () => {
  beforeEach(() => useStore.setState(buildSeed('amali-2026', NOW)));

  it('raises a high-priority alert for every guard and the community manager', () => {
    const before = Object.keys(useStore.getState().notifications).length;
    const r = useStore
      .getState()
      .dispatch('sos.raise', { kind: 'medical' }, { kind: 'resident', id: PERSONA_IDS.james });
    expect(r.ok).toBe(true);
    const state = useStore.getState();
    const fresh = Object.values(state.notifications).filter((n) => n.title === 'SOS — Medical');
    expect(Object.keys(state.notifications).length).toBe(before + fresh.length);
    expect(fresh.length).toBeGreaterThan(0);
    for (const n of fresh) {
      expect(n.priority).toBe('high');
      expect(n.read).toBe(false);
      expect(['guard', 'community_manager']).toContain(state.staff[n.recipientId]?.role);
    }
  });

  it('refuses a non-resident actor', () => {
    const r = useStore
      .getState()
      .dispatch('sos.raise', { kind: 'fire' }, { kind: 'system', id: 'nobody' });
    expect(r.ok).toBe(false);
  });
});

describe('selectNextPadelBooking', () => {
  it('returns nothing for a resident with no booking', () => {
    expect(selectNextPadelBooking({}, 'x', NOW)).toBeUndefined();
  });
});
