'use client';

/**
 * The scenario index (PRD §15), shown inside the presenter menu. Empty
 * until Phase P3+ lands S1–S8.
 */
import { useStore } from '@/store';
import { scenarios } from '@/scenarios';
import { applyStepSetup } from './applyScenarioStep';

export function ScenarioIndex({ onSelect }: { onSelect?: () => void }) {
  const setScenario = useStore((s) => s.setScenario);
  const activeId = useStore((s) => s.demo.scenario?.id);

  function selectScenario(id: string) {
    const scenario = scenarios.find((s) => s.id === id);
    if (!scenario) return;
    setScenario(id, 0);
    applyStepSetup(scenario.steps[0]?.setup);
    onSelect?.();
  }

  if (scenarios.length === 0) {
    return (
      <p className="text-body-3 text-shell-notes-body px-1 py-2">
        No scenarios yet — S1–S8 land with their phases (TRD §13).
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {scenarios.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => selectScenario(s.id)}
            className={`rounded-input text-label-2 w-full px-3 py-2 text-start transition-colors ${
              activeId === s.id
                ? 'bg-shell-stage-active text-shell-stage-active-text'
                : 'text-shell-stage-active hover:bg-shell-stage-border'
            }`}
          >
            <span className="block">
              {s.id} — {s.title}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
