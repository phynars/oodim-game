import { expect, test } from "@playwright/test";

test("a completed delivery re-enters packet-offered with the completed job set", async ({ page }) => {
  await page.goto("/aftersign/");

  // This must remain player-driven: the test taps visible controls and only
  // reads window.__game for state observation.
  await page.locator("#packetButton").click();
  await page.locator("#acknowledgeRouteButton").click();
  await page.locator("#deliverButton").click();
  await expect.poll(() => page.evaluate(() => window.__game?.scene.beat)).toBe("packet-delivered");

  await page.locator("#deliverButton").click();
  await page.locator("#deliverButton").click();
  await page.locator("#deliverButton").click();

  await expect.poll(() => page.evaluate(() => window.__game?.scene.beat)).toBe("packet-offered");
  await expect(page.locator("#job-offer-job-night-transfer")).toBeVisible();
  await expect(page.locator("#job-offer-job-signed-receipt")).toBeVisible();
  await expect(page.locator("#job-offer-safe-default")).toHaveCount(0);
});
