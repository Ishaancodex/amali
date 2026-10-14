import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import { STAFF_IDS, PERSONA_IDS } from '@/seed/personaIds';

function resetDemoSlice() {
  // Reach into the store and restore just the demo slice to a clean, deterministic state
  // between tests (avoids depending on full seed hydration for these nav-only tests).
  useStore.setState({
    demo: {
      clock: { now: '2026-10-14T13:30:00.000Z', mode: 'paused', speed: 1 },
      motionSpeed: 1,
      dualView: false,
      devices: {
        A: {
          slot: 'A',
          role: 'resident',
          actorId: PERSONA_IDS.layla,
          locale: 'en',
          nav: { stack: [{ route: 'home', params: {} }] },
          offline: false,
        },
      },
      tickerOn: false,
      simulatedLatencyMs: [300, 600],
      seed: 'amali-2026',
      version: 1,
    },
  });
}

describe('store/slices/demo — navigation actions', () => {
  beforeEach(resetDemoSlice);

  it('every fresh device session starts with a non-empty nav stack (no race with hydrateFromSeed)', () => {
    expect(useStore.getState().demo.devices.A.nav.stack).toEqual([{ route: 'home', params: {} }]);
  });

  it('pushRoute appends; popRoute removes; popRoute never empties the stack', () => {
    const { pushRoute, popRoute } = useStore.getState();
    pushRoute('A', 'detail', { id: '1' });
    expect(useStore.getState().demo.devices.A.nav.stack).toHaveLength(2);

    popRoute('A');
    expect(useStore.getState().demo.devices.A.nav.stack).toEqual([{ route: 'home', params: {} }]);

    // Popping the last entry is a no-op (TRD §6 — Navigator always has something to show).
    popRoute('A');
    expect(useStore.getState().demo.devices.A.nav.stack).toHaveLength(1);
  });

  it('replaceRoute swaps the top entry without growing the stack', () => {
    const { pushRoute, replaceRoute } = useStore.getState();
    pushRoute('A', 'detail');
    replaceRoute('A', 'detail-edited', { x: '1' });
    const stack = useStore.getState().demo.devices.A.nav.stack;
    expect(stack).toHaveLength(2);
    expect(stack[1]).toEqual({ route: 'detail-edited', params: { x: '1' } });
  });

  it('resetNavTo collapses the stack to a single entry', () => {
    const { pushRoute, resetNavTo } = useStore.getState();
    pushRoute('A', 'detail');
    pushRoute('A', 'detail-2');
    resetNavTo('A', 'settings');
    expect(useStore.getState().demo.devices.A.nav.stack).toEqual([
      { route: 'settings', params: {} },
    ]);
  });

  it('setRole resets the nav stack to a non-empty default, never empty', () => {
    const { pushRoute, setRole } = useStore.getState();
    pushRoute('A', 'detail');
    setRole('A', 'guard', STAFF_IDS.guardImran);
    const device = useStore.getState().demo.devices.A;
    expect(device.role).toBe('guard');
    expect(device.actorId).toBe(STAFF_IDS.guardImran);
    expect(device.nav.stack).toEqual([{ route: 'home', params: {} }]);
  });

  it('setDualView creates device B with a real actor and a non-empty nav stack', () => {
    useStore.getState().setDualView(true);
    const deviceB = useStore.getState().demo.devices.B;
    expect(deviceB).toBeDefined();
    expect(deviceB?.actorId).toBe(STAFF_IDS.guardImran);
    expect(deviceB?.nav.stack).toEqual([{ route: 'home', params: {} }]);
  });

  it('setDualView(false) keeps device B around (so toggling back on preserves its state)', () => {
    useStore.getState().setDualView(true);
    useStore.getState().pushRoute('B', 'detail');
    useStore.getState().setDualView(false);
    useStore.getState().setDualView(true);
    expect(useStore.getState().demo.devices.B?.nav.stack).toHaveLength(2);
  });
});
