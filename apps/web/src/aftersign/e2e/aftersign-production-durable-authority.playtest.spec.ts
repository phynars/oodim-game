import { expect, test } from "@playwright/test";

// This is deliberately opt-in: its target is the deployed Worker, not the
// local preview server used by the ordinary harness suite.
const productionUrl = process.env.AFTERSIGN_PRODUCTION_URL;

test.describe("production durable authority", () => {
  test.skip(!productionUrl, "set AFTERSIGN_PRODUCTION_URL to run against the deployed Worker");

  test("reload keeps the authoritative offered-job branch visible", async ({ page }) => {
    await page.goto(productionUrl!);

    const offeredJobs = page.locator("#offeredJobs");
    await expect(offeredJobs).toBeVisible();

    const offeredJob = offeredJobs.locator("button[data-offered-job-id]").first();
    await expect(offeredJob).toBeVisible();
    await offeredJob.click();

    // A new browser document is the minimum useful reload boundary: the
    // rendered offer must be rebuilt from the Worker-backed save, not retained
    // only in the previous page's JavaScript heap.
    await page.reload();
    await expect(offeredJobs).toBeVisible();
    await expect(offeredJobs.locator("button[data-offered-job-id]")).toHaveCount(1);
  });
});
