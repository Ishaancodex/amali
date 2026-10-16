/**
 * Headless scenario runner (TRD §10): for each step, applies `setup`
 * (clock/role — role/device setup doesn't matter headless, but the clock
 * does), runs `script` against the real store via `dispatch`, then checks
 * `expect`. This is what proves a scenario works before the demo.
 */
import { useStore } from '@/store';
import { buildSeed } from '@/seed';
import '@/store/commands/registerAll';
import '@/scheduler/registerJobs';
import { schedulerEngine } from '@/scheduler/engine';
import type { Scenario } from '@/scenarios/types';

export function runScenario(scenario: Scenario): void {
  useStore.setState(buildSeed('amali-2026', scenario.startAt));
  schedulerEngine.queue.clear();

  if (scenario.fixtures) {
    useStore.setState((draft) => {
      scenario.fixtures?.(draft);
    });
  }

  for (const step of scenario.steps) {
    if (step.setup?.clock) {
      const clock = step.setup.clock;
      if (typeof clock === 'string') {
        useStore.setState((s) => {
          s.demo.clock.now = clock;
        });
      }
      schedulerEngine.runDue(useStore.getState().demo.clock.now);
    }

    for (const entry of step.script ?? []) {
      const input =
        typeof entry.input === 'function'
          ? (entry.input as (s: ReturnType<typeof useStore.getState>) => unknown)(
              useStore.getState(),
            )
          : entry.input;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- script entries are typed as data (CommandName isn't known until runtime here)
      const result = useStore.getState().dispatch(entry.command as any, input as any, entry.actor, {
        assignedAmenities: entry.assignedAmenities,
      });
      if (!result.ok) {
        throw new Error(
          `Scenario "${scenario.id}", step "${step.title}": ${entry.command} failed — ${result.error.code}: ${result.error.message}`,
        );
      }
    }

    if (step.expect) {
      step.expect(useStore.getState());
    }
  }
}
