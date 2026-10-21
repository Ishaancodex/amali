/**
 * Flows driven through the UI itself (TRD §15): a padel booking by tapping,
 * the Arabic/RTL switch, two-tab sync, and the full rehearsal — Reset, then
 * S1–S8 back to back in one page with a clean console (P11 exit criteria).
 */
import { test, expect } from '@playwright/test';
import { scenarios } from '@/scenarios';
import { device, expectAccessible, openDemo, playStep, settle, startScenario } from './helpers';

test('a resident books padel by tapping through the app', async ({ page }) => {
  const errors = await openDemo(page);
  const a = device(page, 'A');
  await a.getByRole('button', { name: 'Amenities' }).click();
  await a.getByRole('button', { name: 'Padel Tennis Court' }).first().click();
  await a.getByRole('button', { name: 'Book', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Book Padel' })).toBeVisible();

  await a.getByRole('button', { name: /^Thu 15$/ }).click();
  await a.getByRole('button', { name: '20:00', exact: true }).click();
  await a.getByRole('button', { name: 'Book 20:00' }).click();

  await expect(a.getByText('Padel court booked')).toBeVisible();
  await settle(page);
  await expectAccessible(page, 'padel confirmed');
  expect(errors).toEqual([]);
});

test('Arabic flips the device to RTL with a cross-fade and keeps form state', async ({ page }) => {
  const errors = await openDemo(page);
  const a = device(page, 'A');
  await a.getByRole('button', { name: 'Search' }).click();
  const field = a.getByPlaceholder('Search amenities, events, announcements');
  await field.fill('Pool');

  await page.evaluate(() => window.__amali.setLocale('A', 'ar'));
  const root = a.locator('[dir]').first();
  await expect(root).toHaveAttribute('dir', 'rtl');
  await expect(root).toHaveAttribute('lang', 'ar');
  // Same input, still holding what was typed; the copy is Arabic now.
  await expect(a.getByRole('textbox')).toHaveValue('Pool');
  await expect(a.getByRole('heading', { name: 'بحث' })).toBeVisible();
  await expect(a).toContainText('مسبح البالغين');
  // Arabic text renders in IBM Plex Sans Arabic.
  const font = await a
    .getByRole('heading', { name: 'بحث' })
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(font).toMatch(/^"?IBM Plex Sans Arabic/);

  await settle(page);
  await expectAccessible(page, 'Arabic search');
  expect(errors).toEqual([]);
});

test('a change in one tab shows in the other (multi-tab sync)', async ({ context }) => {
  const first = await context.newPage();
  await openDemo(first);
  const second = await context.newPage();
  await openDemo(second);

  // Switching tab two's device to the Guard app is broadcast to tab one.
  await second.getByRole('button', { name: 'Guard', exact: true }).click();
  await expect(device(first, 'A')).toContainText('Pool occupancy');
});

test('full rehearsal: Reset, then S1–S8 back to back, console clean', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await openDemo(page);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(device(page, 'A')).toContainText('Today at Amali');

  for (const scenario of scenarios) {
    await startScenario(page, scenario.id);
    for (const index of scenario.steps.keys()) await playStep(page, scenario.id, index);
    await expect(device(page, 'A')).not.toContainText('Something went wrong');
  }
  expect(errors).toEqual([]);
});
