import { expect, test } from "@playwright/test";

test("AFTERSIGN M-LOOP served surface exposes an offered-jobs tray", async ({
  page,
}) => {
  await page.goto(`/aftersign/?slot=mloop-verification-${Date.now()}`, {
    waitUntil: "load",
  });

  const tray = page.locator("#offeredJobs");
  await expect(tray).toBeVisible();
  await expect(tray.locator("button[data-offered-job-id]").first()).toBeVisible();
});
