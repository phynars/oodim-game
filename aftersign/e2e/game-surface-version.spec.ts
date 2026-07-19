import { expect, test } from '@playwright/test';

// Cold-start budget matches other AFTERSIGN e2e specs: SwiftShader + esm.sh
// three.js imports on CI regularly exceed Playwright's default 30s per-test
// timeout during the aftersign lane's cold boot. Without this override the
// spec races the wall clock instead of the surface contract and reports as
// a false red — the exact flake shape #700/#706 flagged and #714's CI
// re-review is chasing. See playwright.config.ts for the full rationale.
const COLD_START_MS = 90_000;

test('window.__game publishes version 1 in the runnable packet-intent slice', async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto('/?slot=packet-intent-scene');

  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: 60_000 });
  const version = await page.evaluate(() => window.__game?.version);

  expect(version).toBe(1);
});
