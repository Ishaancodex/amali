import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (TRD §15): runs against the production static export, not `pnpm dev` —
 * it is what gets presented, and a `next build` beside a running dev
 * server corrupts the dev server's `.next` (the P4 footgun), so the build
 * writes to `.next-e2e` (with a custom `distDir`, the static export lands
 * there too, not in `out/`). Set E2E_SKIP_BUILD=1 to reuse the last build.
 */
const PORT = 4321;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `${process.env.E2E_SKIP_BUILD ? '' : 'NEXT_DIST_DIR=.next-e2e pnpm -s build && '}node scripts/serve-static.mjs .next-e2e ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The installed Google Chrome — no separate browser download needed.
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
