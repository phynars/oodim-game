import { expect, test } from "@playwright/test";

test("Return to Io does not choose a return tone from the same pointer gesture", async ({ page }) => {
  await page.goto(`/aftersign/index.html?slot=return-to-io-settle-${Date.now()}`);

  await page.locator("#packetButton").click();
  await page.locator("#skipRouteButton").click();
  await page.locator("#deliverButton").click();

  await expect(page.locator("#deliverButton")).toHaveText("Return to Io");
  await page.locator("#deliverButton").click();

  await expect.poll(() => page.evaluate(() => window.__game?.getSnapshot().scene.beat)).toBe(
    "io-return-recognition",
  );
  await expect.poll(() => page.evaluate(() => window.__game?.getSnapshot().player.returnReason)).toBeNull();
  await expect(page.locator("#line")).not.toContainText("Good. Wanting is easier to route than pretending.");

  await page.waitForTimeout(300);
  await page.locator("#skipRouteButton").click();
  await expect.poll(() => page.evaluate(() => window.__game?.getSnapshot().player.returnReason)).toBe(
    "evasive",
  );
  await expect(page.locator("#line")).toContainText("I hear the dodge in that answer.");

  await page.locator("#deliverButton").click();
  await expect.poll(() => page.evaluate(() => window.__game?.getSnapshot().scene.beat)).toBe(
    "io-next-job",
  );
  await expect(page.locator("#line")).toContainText("You chose the side door last time.");
});
