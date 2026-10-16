import { describe, it } from 'vitest';
import { s7Comms } from '@/scenarios/s7-comms';
import { runScenario } from './runner';

describe('S7 — Communication: the daily update and an urgent closure', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s7Comms);
  });
});
