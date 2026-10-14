'use client';

/**
 * Shell keyboard shortcuts (PRD §4.1): `1`-`6` switch roles, `T` jumps the
 * clock +15 min, `D` toggles dual view, `←`/`→` step the notes panel.
 * Ignored while typing in an input/textarea/contenteditable.
 */
import { useEffect } from 'react';
import { useStore } from '@/store';
import { useDemoClock } from '@/scheduler/useDemoClock';
import { getScenario } from '@/scenarios';
import { selectRole } from './TopBar/RolePill';
import { applyStepSetup } from './applyScenarioStep';
import type { Role } from '@/types/demo';

const ROLE_KEYS: Record<string, Role> = {
  '1': 'resident',
  '2': 'whatsapp',
  '3': 'guard',
  '4': 'creche',
  '5': 'fnb',
  '6': 'console',
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function useShellShortcuts() {
  const dualView = useStore((s) => s.demo.dualView);
  const setDualView = useStore((s) => s.setDualView);
  const scenarioState = useStore((s) => s.demo.scenario);
  const setScenario = useStore((s) => s.setScenario);
  const { jump } = useDemoClock();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key in ROLE_KEYS) {
        selectRole('A', ROLE_KEYS[e.key] as Role);
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        jump('+15m');
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        setDualView(!dualView);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!scenarioState) return;
        const scenario = getScenario(scenarioState.id);
        if (!scenario) return;
        const next = scenarioState.step + (e.key === 'ArrowRight' ? 1 : -1);
        const clamped = Math.max(0, Math.min(scenario.steps.length - 1, next));
        if (clamped === scenarioState.step) return;
        setScenario(scenario.id, clamped);
        applyStepSetup(scenario.steps[clamped]?.setup);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dualView, setDualView, scenarioState, setScenario, jump]);
}
