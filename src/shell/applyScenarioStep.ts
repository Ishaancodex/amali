/**
 * "Take me there" (TRD §10): applies a scenario step's `setup` — role,
 * persona, dual view, clock, deep link — without running its `script`
 * (that's only for the headless scenario tests). Shared by the notes
 * panel and the scenario index menu.
 */
import { useStore } from '@/store';
import { parseDeepLink } from '@/navigation/deepLinks';
import type { ClockJump } from '@/scheduler/clock';
import type { ScenarioStepSetup } from '@/scenarios/types';

export function applyStepSetup(setup?: ScenarioStepSetup): void {
  if (!setup) return;
  const store = useStore.getState();

  if (setup.clock) {
    if (typeof setup.clock === 'string') {
      store.setClockNow(setup.clock);
    } else {
      store.jumpClock(setup.clock.jump as ClockJump);
    }
  }
  if (setup.fixtures) {
    const fixtures = setup.fixtures;
    useStore.setState((draft) => {
      fixtures(draft);
    });
  }
  if (setup.dualView !== undefined) {
    store.setDualView(setup.dualView);
  }
  for (const slot of ['A', 'B'] as const) {
    const device = setup.devices[slot];
    if (!device) continue;
    store.setRole(slot, device.role, device.actorId);
    if (device.consoleRole) store.setConsoleRole(slot, device.consoleRole);
    if (device.deepLink) {
      const link = parseDeepLink(device.deepLink);
      if (link) store.resetNavTo(slot, link.route, link.params);
    }
  }
}
