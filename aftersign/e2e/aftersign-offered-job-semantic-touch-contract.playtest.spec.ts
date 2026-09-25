import { expect, test } from "@playwright/test";

// This is a player-driven phone contract: the initial job offer must expose an
// accessible name before the player taps it, so its purpose survives both a
// compact viewport and assistive input.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("fresh courier can identify and tap the rendered safe job offer", async ({ page }) => {
  await page.goto("/aftersign/?slot=semantic-offered-job-touch", {
    waitUntil: "load",
  });

  const offer = page.locator("#packetButton");
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await expect(offer).toBeEnabled();
  await expect(offer).toHaveAccessibleName(/take|job|packet/i);

  await offer.tap();
  await expect(page.locator("[data-aftersign-route-risk-surface]")).toBeVisible({
    timeout: 15_000,
  });
});
