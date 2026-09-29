import { expect, test } from '@playwright/test';

const PHONE = { width: 390, height: 844 };

test.describe('AFTERSIGN recognition survives reload', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

  test('a player can tap through delivery, reload, and still see Io recognition', async ({ page }) => {
    await page.goto('/aftersign/');

    await page.locator('button').filter({ hasText: /begin|start|take/i }).first().tap();
    await page.locator('button').filter({ hasText: /sealed|keep|preserve/i }).first().tap();
    await page.locator('button').filter({ hasText: /deliver|send|continue/i }).first().tap();

    const recognition = page.locator('[data-story-beat="io-return-recognition"]');
    await expect(recognition).toBeVisible();
    await expect(recognition).toContainText(/seal|trust|came back/i);

    await page.reload();

    await expect(recognition).toBeVisible();
    await expect(recognition).toContainText(/seal|trust|came back/i);
    await expect(page.locator('button').filter({ hasText: /kind|evasive|blunt/i }).first()).toBeVisible();
  });
});
