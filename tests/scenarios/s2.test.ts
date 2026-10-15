import { describe, it } from 'vitest';
import { s2Blackout } from '@/scenarios/s2-blackout';
import { runScenario } from './runner';

describe('S2 — Padel blackout for maintenance', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s2Blackout);
  });
});
