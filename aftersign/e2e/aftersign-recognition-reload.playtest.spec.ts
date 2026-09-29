import { expect, test } from '@playwright/test';

/**
 * Player-facing regression gate for recognition restoration. This test must
 * advance only through rendered controls: __game is assertion-only.
 */
test('reload keeps Io recognition actionable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/aftersign/?playerId=recognition-reload-playtest');

  // The flow setup belongs to the served interaction surface. Once the
  // recognition beat is visible, a browser reload must not strand a player at
  // an earlier beat or remove the tone controls needed to continue.
  await expect(page.locator('[data-story-beat="io-return-recognition"]')).toBeVisible();
  await expect(page.getByText(/You came back\./)).toBeVisible();
  await expect(page.locator('[data-route-risk-tone]')).toBeVisible();

  await page.reload();

  await expect(page.locator('[data-story-beat="io-return-recognition"]')).toBeVisible();
  await expect(page.getByText(/You came back\./)).toBeVisible();
  await expect(page.locator('[data-route-risk-tone]')).toBeVisible();
});
