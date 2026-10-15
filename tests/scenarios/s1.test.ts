import { describe, it } from 'vitest';
import { s1Padel } from '@/scenarios/s1-padel';
import { runScenario } from './runner';

describe('S1 — Padel: fair booking, a waitlist and a no-show', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s1Padel);
  });
});
