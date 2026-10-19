import { describe, it } from 'vitest';
import { s5Dining } from '@/scenarios/s5-dining';
import { runScenario } from './runner';

describe('S5 — Dining: Teppanyaki and the wallet', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s5Dining);
  });
});
