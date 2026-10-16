import { describe, it } from 'vitest';
import { s3Screening } from '@/scenarios/s3-screening';
import { runScenario } from './runner';

describe('S3 — Screening Room: Family Movie Night', () => {
  it('runs every step headless, end to end', () => {
    runScenario(s3Screening);
  });
});
