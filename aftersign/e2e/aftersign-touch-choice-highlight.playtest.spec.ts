import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test("touch delivery does not pre-highlight a newly rendered return choice", async ({ page }) => {
  await page.goto(`/aftersign/?slot=touch-choice-highlight-${Date.now()}`);

  const deliver = page.locator("#deliverButton");
  await expect(deliver).toContainText(/deliver packet/i);
  await deliver.tap();

  const choices = page.locator(
    "#acknowledgeRouteButton, #skipRouteButton, #deliverButton",
  );
  await expect(choices).toHaveCount(3);
  await expect(page.locator("#acknowledgeRouteButton")).toContainText(/kind return/i);

  for (const choice of await choices.all()) {
    await expect(choice).toHaveCSS("filter", "none");
  }

  const kindReturn = page.locator("#acknowledgeRouteButton");
  await kindReturn.tap();
  await expect(kindReturn).toBeDisabled();
  await expect(page.locator("#skipRouteButton")).toBeDisabled();
  await expect(page.locator("#deliverButton")).toContainText(/ask for next job/i);
});
