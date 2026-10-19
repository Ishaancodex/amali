import { describe, it } from 'vitest';
import { s6PoolGym } from '@/scenarios/s6-pool-gym';
import { runScenario } from './runner';

describe('S6 — Pool & Gym: one operational day', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s6PoolGym);
  });
});
