import { expect, test } from "@playwright/test";

// Player-path regression: a reload during Io's recognition must restore the
// persisted beat instead of dropping the courier back at a fresh offer.
// This intentionally uses only rendered controls; window.__game is assertion
// data, never the input mechanism.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("a phone player can reload at Io recognition without losing the return beat", async ({ page }) => {
  await page.goto("/aftersign/");

  await page.locator('button[data-offered-job-id="safe"]').tap();
  await page.locator('button[data-route-risk="lit-stair"]').tap();
  await page.locator('button[data-choice="deliver-packet"]').tap();

  const scene = page.locator("[data-beat]");
  await expect(scene).toHaveAttribute("data-beat", "io-return-recognition");
  await expect(page.locator("#line")).toContainText(/You came back/i);

  await page.reload();

  await expect(scene).toHaveAttribute("data-beat", "io-return-recognition");
  await expect(page.locator("#line")).toContainText(/You came back/i);
  await expect(page.locator('button[data-return-reason="blunt"]')).toBeVisible();
});
