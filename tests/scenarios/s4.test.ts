import { describe, it } from 'vitest';
import { s4Creche } from '@/scenarios/s4-creche';
import { runScenario } from './runner';

describe('S4 — Creche: a supervised session with a ratio change', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s4Creche);
  });
});
