import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type StepResult = { ok: true } | { ok: false; error: string };
type Bridge = {
  startScenario: (id: string) => StepResult;
  runStep: (id: string, index: number) => StepResult;
  setLocale: (slot: 'A' | 'B', locale: 'en' | 'ar') => void;
  setMotionSpeed: (speed: 0 | 0.5 | 1) => void;
};
declare global {
  interface Window {
    __amali: Bridge;
  }
}

/**
 * Opens the demo with the e2e bridge and starts collecting console errors.
 * Motion is off unless asked for: axe samples colours, and a card caught
 * mid-fade reads as low contrast.
 */
export async function openDemo(page: Page, { motion = false } = {}): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?e2e');
  await page.waitForFunction(() => !!window.__amali);
  if (!motion) await page.evaluate(() => window.__amali.setMotionSpeed(0));
  return errors;
}

export async function startScenario(page: Page, id: string): Promise<void> {
  expect(await page.evaluate((s) => window.__amali.startScenario(s), id)).toEqual({ ok: true });
}

/** "Take me there" + the step's script; the step's own expectations must pass. */
export async function playStep(page: Page, id: string, index: number): Promise<void> {
  const result = await page.evaluate(([s, i]) => window.__amali.runStep(s, i), [
    id,
    index,
  ] as const);
  expect(result, `${id} step ${index}`).toEqual({ ok: true });
}

export function device(page: Page, slot: 'A' | 'B' = 'A') {
  return page.locator(`[data-device="${slot}"]`);
}

/** PRD §15 / TRD §9.7: zero serious or critical axe issues. */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).include('[data-device]').analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')} — ${v.nodes[0]?.any[0]?.message ?? ''}`,
    );
  expect(serious, `axe — ${label}`).toEqual([]);
}

/** Lets entry animations settle before a screenshot or axe pass. */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(700);
}
