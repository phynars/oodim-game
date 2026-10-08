import { expect, test } from "@playwright/test";

test("route acknowledgement visibly remains selected after a player tap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/aftersign/");

  await page.locator('[data-job-id="job-safe-delivery"], #packetButton').first().tap();

  const acknowledgeRoute = page.locator("#acknowledgeRouteButton");
  await expect(acknowledgeRoute).toBeVisible();
  await acknowledgeRoute.tap();

  await expect(acknowledgeRoute).toHaveAttribute("aria-pressed", "true");
});
