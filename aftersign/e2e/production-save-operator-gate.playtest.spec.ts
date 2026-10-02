import { expect, test } from '@playwright/test';

/**
 * This gate intentionally requires an explicitly supplied deployed URL. It
 * prevents the local preview suite from being misreported as production save
 * verification while keeping the live check as a rendered, phone-sized flow.
 */
const productionUrl = process.env.AFTERSIGN_PRODUCTION_URL;

test.describe('production save operator gate', () => {
  test.skip(!productionUrl, 'Set AFTERSIGN_PRODUCTION_URL during an operator-coordinated live save verification.');

  test('serves the AFTERSIGN kiosk at the configured production URL', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(productionUrl!, { waitUntil: 'domcontentloaded' });

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/AFTERSIGN/i);
  });
});
