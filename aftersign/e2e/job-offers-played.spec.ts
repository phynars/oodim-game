import { expect, test } from "@playwright/test";

test("served job offers follow completed delivery memory through real taps", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#job-offer-safe-default")).toHaveCount(1);
  await expect(page.locator("#offeredJobs button")).toHaveCount(1);

  await page.locator("#packetButton").click();
  await page.locator("#acknowledgeRouteButton").click();
  await page.locator("#deliverButton").click();
  await expect(page.locator("#stateReadout")).toContainText("io-return-recognition");
  await page.locator("#acknowledgeRouteButton").click();
  await expect(page.locator("#stateReadout")).toContainText("return-tone-choice");
  await page.locator("#deliverButton").click();
  await expect(page.locator("#stateReadout")).toContainText("io-next-job");
  await page.locator("#deliverButton").click();

  await expect(page.locator("#job-offer-job-night-transfer")).toHaveCount(1);
  await expect(page.locator("#job-offer-job-signed-receipt")).toHaveCount(1);
  await expect(page.locator("#job-offer-safe-default")).toHaveCount(0);
});
