import { test, expect } from '@playwright/test';

test('io recognition feedback lands within 1220ms after returning to the scene', async ({ page }) => {
  await page.goto('/aftersign');

  // Returning-session path: player has already made the packet choice in a prior run.
  await page.evaluate(() => {
    localStorage.setItem('aftersign.story.packetChoice', 'open');
    localStorage.setItem('aftersign.story.ioHasSeenChoice', 'true');
  });

  await page.reload();

  const t0 = await page.evaluate(() => performance.now());

  // Trigger the first Io recognition beat in the vertical slice.
  await page.getByTestId('start-episode-1').click();
  await page.getByTestId('approach-io').click();

  const recognition = page.getByTestId('io-recognition-feedback');
  await expect(recognition).toBeVisible({ timeout: 1220 });

  const dt = await page.evaluate((start) => performance.now() - start, t0);
  expect(dt).toBeLessThanOrEqual(1220);
});
