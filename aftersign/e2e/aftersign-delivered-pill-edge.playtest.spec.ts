import { expect, test } from "@playwright/test";

test("phone delivered beat leaves every visible pill exposed at its right edge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/aftersign/");

  await page.locator("#packetButton").tap();
  await page.locator("#deliverButton").tap();
  await expect(page.locator("#stateReadout")).toContainText("packet-delivered");

  await page.locator("#deliverButton").tap();
  await expect(page.locator('button[data-return-reason]:not([disabled])').first()).toBeVisible();

  const coveredPills = await page.locator("button:visible").evaluateAll((buttons) =>
    buttons
      .filter((button) => getComputedStyle(button).borderRadius !== "0px")
      .map((button) => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.right - 1, box.top + box.height / 2);
        return hit === button || button.contains(hit) ? null : button.id || button.textContent?.trim();
      })
      .filter(Boolean),
  );

  expect(coveredPills).toEqual([]);
  await expect(page).toHaveScreenshot("aftersign-delivered-pill-edge-phone.png", {
    fullPage: true,
  });
});
