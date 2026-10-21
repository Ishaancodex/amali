/**
 * Frame timing for the two PRD §13.3 checks — the role switch and the urgent
 * closure — sampled with requestAnimationFrame while each animation plays.
 * Opt-in (`PERF=1`): frame times on a shared, loaded machine are evidence,
 * not a stable CI gate. Writes test-results/perf.json.
 */
import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openDemo, playStep, startScenario } from './helpers';

test.skip(!process.env.PERF, 'set PERF=1 to measure frame timing');

async function sampleFrames(page: Page, action: () => Promise<void>, ms = 1500) {
  await page.evaluate((duration) => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const start = last;
    const tick = (now: number) => {
      w.__frames.push(now - last);
      last = now;
      if (now - start < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
  await action();
  await page.waitForTimeout(ms + 200);
  const frames = await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames);
  const sorted = [...frames].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  return {
    frames: frames.length,
    avgFps: Math.round(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)),
    p95FrameMs: Math.round(pct(0.95) * 10) / 10,
    longFrames: frames.filter((f) => f > 34).length,
  };
}

test('frame timing: role switch and urgent closure', async ({ page }) => {
  await openDemo(page, { motion: true });
  const results: Record<string, unknown> = {};

  results.roleSwitchToConsole = await sampleFrames(page, () =>
    page.getByRole('button', { name: 'Management', exact: true }).click(),
  );
  results.roleSwitchToGuard = await sampleFrames(page, () =>
    page.getByRole('button', { name: 'Guard', exact: true }).click(),
  );

  await startScenario(page, 'S7');
  for (const i of [0, 1, 2]) await playStep(page, 'S7', i);
  results.urgentClosureDualView = await sampleFrames(page, () => playStep(page, 'S7', 3));

  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/perf.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
});
