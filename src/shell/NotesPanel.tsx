'use client';

/**
 * Scenario notes panel (PRD §4.1, M2): an uppercase tracked label, a large
 * step number, a title, a rule line that draws in, and body copy. Steps
 * are clickable and apply "Take me there" (role/persona/clock) on select.
 * Empty until scenarios exist (Phase P3+).
 */
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/store';
import { getScenario } from '@/scenarios';
import { dur, ease } from '@/design/motion';
import { applyStepSetup } from './applyScenarioStep';

export function NotesPanel() {
  const scenarioState = useStore((s) => s.demo.scenario);
  const setScenario = useStore((s) => s.setScenario);

  const scenario = scenarioState ? getScenario(scenarioState.id) : undefined;
  const stepIndex = scenarioState?.step ?? 0;
  const step = scenario?.steps[stepIndex];

  function goTo(index: number) {
    if (!scenario) return;
    const clamped = Math.max(0, Math.min(scenario.steps.length - 1, index));
    setScenario(scenario.id, clamped);
    applyStepSetup(scenario.steps[clamped]?.setup);
  }

  if (!scenario || !step) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="border-shell-stage-border h-10 w-10 rounded-full border border-dashed" />
        <p className="font-shell-label text-shell-label text-shell-notes-label uppercase">
          Scenario notes
        </p>
        <p className="text-shell-body text-shell-notes-body max-w-[220px]">
          No scenario selected. Open the menu to pick one once they&apos;re built.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 px-6 py-8">
      <span className="font-shell-label text-shell-label text-shell-notes-label uppercase">
        Scenario notes
      </span>
      <span key={`num-${stepIndex}`} className="text-shell-number text-shell-notes-number">
        {String(stepIndex + 1).padStart(2, '0')}
      </span>
      <h2 className="text-shell-heading text-shell-stage-active">{step.title}</h2>
      <motion.div
        key={`rule-${stepIndex}`}
        className="bg-shell-stage-rule h-px"
        initial={{ width: 0 }}
        animate={{ width: 64 }}
        transition={{ duration: dur.base, ease: ease.standard }}
      />
      <p className="text-shell-body text-shell-notes-body flex-1 overflow-y-auto">{step.body}</p>

      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-1.5">
          {scenario.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Step ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === stepIndex ? 'bg-shell-stage-active' : 'bg-shell-stage-border'
              }`}
            />
          ))}
        </div>
        <div className="font-shell-label text-shell-label text-shell-notes-label flex items-center gap-4 uppercase">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => goTo(stepIndex - 1)}
            className="flex items-center gap-1 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Prev
          </button>
          <button
            type="button"
            disabled={stepIndex === scenario.steps.length - 1}
            onClick={() => goTo(stepIndex + 1)}
            className="flex items-center gap-1 disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
