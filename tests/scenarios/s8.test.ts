import { describe, it } from 'vitest';
import { s8Management } from '@/scenarios/s8-management';
import { runScenario } from './runner';

describe('S8 — Management: reports and access', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s8Management);
  });
});
