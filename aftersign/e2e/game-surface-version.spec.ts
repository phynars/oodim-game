import { expect, test } from '@playwright/test';

test('window.__game publishes version 1 in the runnable packet-intent slice', async ({ page }) => {
  await page.goto('/?slot=packet-intent-scene');

  await page.waitForFunction(() => window.__game?.version === 1);
  const version = await page.evaluate(() => window.__game?.version);

  expect(version).toBe(1);
});
