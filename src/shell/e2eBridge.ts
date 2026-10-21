/**
 * The Playwright bridge (TRD §15 "E2E"). Installed only when the page is
 * opened with `?e2e`: it lets a spec start a scenario and play a step the
 * way a presenter does — "Take me there" for the step's setup (role,
 * persona, screen, clock, fixtures), then the step's script through the
 * same `dispatch()` the screens use — and reports the step's own `expect`.
 * The spec then checks what the device actually renders.
 */
import { useStore } from '@/store';
import { hydrateFromSeed } from '@/store/bootstrap';
import { getScenario } from '@/scenarios';
import { runDueAndSync } from '@/scheduler/runDueAndSync';
import { applyStepSetup } from './applyScenarioStep';

type StepResult = { ok: true } | { ok: false; error: string };

export interface AmaliE2E {
  startScenario: (id: string) => StepResult;
  runStep: (id: string, index: number) => StepResult;
  setLocale: (slot: 'A' | 'B', locale: 'en' | 'ar') => void;
  /** The presenter's Motion speed — specs that check what's on screen run with 0 (instant). */
  setMotionSpeed: (speed: 0 | 0.5 | 1) => void;
}

function attempt(fn: () => void): StepResult {
  try {
    fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function installE2EBridge(): void {
  if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('e2e'))
    return;
  const bridge: AmaliE2E = {
    startScenario: (id) =>
      attempt(() => {
        const scenario = getScenario(id);
        if (!scenario) throw new Error(`No scenario ${id}`);
        // The seed carries the demo settings too — keep the spec's motion speed across the reseed.
        const motionSpeed = useStore.getState().demo.motionSpeed;
        hydrateFromSeed(undefined, scenario.startAt);
        useStore.getState().setMotionSpeed(motionSpeed);
        if (scenario.fixtures) {
          const fixtures = scenario.fixtures;
          useStore.setState((draft) => {
            fixtures(draft);
          });
        }
      }),
    runStep: (id, index) =>
      attempt(() => {
        const scenario = getScenario(id);
        const step = scenario?.steps[index];
        if (!scenario || !step) throw new Error(`No step ${id}#${index}`);
        useStore.getState().setScenario(id, index);
        applyStepSetup({
          devices: {},
          ...step.setup,
          clock: step.setup?.clock ?? (index === 0 ? scenario.startAt : undefined),
        });
        // Jobs are idempotent, so this is safe even when this tab already ran them as leader.
        runDueAndSync(useStore.getState().demo.clock.now);
        for (const entry of step.script ?? []) {
          const state = useStore.getState();
          const input =
            typeof entry.input === 'function'
              ? (entry.input as (s: typeof state) => unknown)(state)
              : entry.input;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- script entries are data
          const result = state.dispatch(entry.command as any, input as any, entry.actor, {
            assignedAmenities: entry.assignedAmenities,
          });
          if (!result.ok)
            throw new Error(`${entry.command}: ${result.error.code} ${result.error.message}`);
        }
        step.expect?.(useStore.getState());
      }),
    setLocale: (slot, locale) => useStore.getState().setLocale(slot, locale),
    setMotionSpeed: (speed) => useStore.getState().setMotionSpeed(speed),
  };
  (window as unknown as { __amali: AmaliE2E }).__amali = bridge;
}
