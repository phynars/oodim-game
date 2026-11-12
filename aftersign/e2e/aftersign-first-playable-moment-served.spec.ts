import { expect, test } from "@playwright/test";

// Local served-page regression gate: a player arriving at AFTERSIGN must
// reach a visible first job offer, not merely a loaded WebGL canvas. Its
// button-state marker and actionable route identifier are asserted separately.
test("served page reaches the first playable job offer", async ({ page }) => {
  // The game's own path: on the deployed Worker "/" is the portfolio
  // landing page, not the game (only the preview server serves it there).
  await page.goto("/aftersign/");

  const jobTake = page.locator("[data-aftersign-job-take]");
  await expect(jobTake).toBeVisible();
  await expect(jobTake).toHaveAttribute(
    "data-aftersign-job-take-action",
    "mloop-safe-delivery-take",
  );
});
