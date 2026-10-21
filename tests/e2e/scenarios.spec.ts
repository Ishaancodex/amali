/**
 * S1–S8 in a real browser (TRD §15 "E2E — one spec per scenario"). Each
 * step is played the way a presenter plays it ("Take me there", then the
 * step's actions), its own expectations must hold, and the device must
 * show what the step is about. Every step gets an axe pass; the whole run
 * must leave the console clean (P11 exit criteria).
 */
import { test, expect } from '@playwright/test';
import { scenarios } from '@/scenarios';
import { device, expectAccessible, openDemo, playStep, settle, startScenario } from './helpers';

type Check = { A?: (string | RegExp)[]; B?: (string | RegExp)[]; notA?: (string | RegExp)[] };

/** What each device must show after a step (only the steps with something specific to see). */
const CHECKS: Record<string, Record<number, Check>> = {
  S1: {
    0: { A: ['Good evening, James'] },
    3: { A: ['Good afternoon, James'] },
    4: { A: ['Amali Residences'] },
    5: { A: ['Amali Residences'] },
    6: { A: ['Pool occupancy'] },
  },
  S2: { 0: { A: ['Communications', 'Urgent closure'] }, 1: { A: ['Good evening, Ahmed'] } },
  S3: { 4: { A: ['Amali Residences'] }, 5: { A: ['Pool occupancy'] } },
  S4: {
    0: { A: ['Omar', 'Authorised guardians'] },
    1: { A: ['Check-in / out'] },
    2: { A: ['In the Playroom'], B: ['Kids'] },
    3: { A: ['Roster'], B: [/Over ratio by \d/] },
    5: { A: ["Kids' Club"] },
    7: { A: ["Creche and Kids' Playroom"] },
  },
  S5: {
    0: { A: ['Reserve a table'] },
    1: { A: ['Arrivals', 'Teppanyaki'] },
    4: { A: ['Arrivals'], B: ['Balance'] },
  },
  S6: {
    0: { A: ['Checklists'] },
    2: { A: ['Adult Pool', 'Limited'] },
    3: { A: ['Live occupancy'], B: ['Pool occupancy'] },
    4: { A: ['Work orders'] },
  },
  S7: {
    2: { A: ['Communications'] },
    3: { B: ['Clear the pool'] },
    4: { A: ['Communications'] },
  },
  S8: {
    0: { A: ['Generate report', 'Roles & access'] },
    1: { A: ['Generate report'], notA: ['Roles & access'] },
    2: { A: ['Residents', /•••/] },
    3: { A: ['Not available for your role'] },
  },
};

for (const scenario of scenarios) {
  test(`${scenario.id} — ${scenario.title}`, async ({ page }) => {
    const errors = await openDemo(page);
    await startScenario(page, scenario.id);

    for (const [index, step] of scenario.steps.entries()) {
      await test.step(`${index}: ${step.title}`, async () => {
        await playStep(page, scenario.id, index);
        const a = device(page, 'A');
        await expect(a).toBeVisible();
        await expect(a).not.toContainText('Something went wrong');
        const check = CHECKS[scenario.id]?.[index];
        for (const text of check?.A ?? []) await expect(a).toContainText(text);
        for (const text of check?.notA ?? []) await expect(a).not.toContainText(text);
        for (const text of check?.B ?? []) await expect(device(page, 'B')).toContainText(text);
        await settle(page);
        await expectAccessible(page, `${scenario.id} step ${index}`);
      });
    }

    expect(errors, 'console errors').toEqual([]);
  });
}
