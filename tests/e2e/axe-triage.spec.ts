import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { scenarios } from '@/scenarios';
import { openDemo, playStep, settle, startScenario } from './helpers';

test.skip(!process.env.AXE_TRIAGE, 'triage only');
test('collect axe violations', async ({ page }) => {
  test.setTimeout(600_000);
  await openDemo(page);
  const seen = new Map<string, string>();
  for (const s of scenarios) {
    await startScenario(page, s.id);
    for (const [i] of s.steps.entries()) {
      await playStep(page, s.id, i);
      await settle(page);
      const r = await new AxeBuilder({ page }).include('[data-device]').analyze();
      for (const v of r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'))
        for (const n of v.nodes) {
          const key = `${v.id} ${n.target.join(' ')}`;
          if (!seen.has(key))
            seen.set(
              key,
              `${s.id}#${i} ${v.id} | ${n.html.slice(0, 160)} | ${n.any[0]?.message ?? ''}`,
            );
        }
    }
  }
  writeFileSync('test-results/axe-triage.txt', [...seen.values()].join('\n'));
});
