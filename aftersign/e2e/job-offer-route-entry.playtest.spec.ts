import { expect, test } from "@playwright/test";

const uniqueSlot = () => `job-offer-route-entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function waitForReady(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(() => window.__game?.scene?.ready)).toBe(true);
}

async function waitForBeat(
  page: import("@playwright/test").Page,
  beat: string,
) {
  await expect
    .poll(() => page.evaluate(() => window.__game?.scene?.beat))
    .toBe(beat);
}

test("a player taps the offered safe job and enters its route choice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/aftersign/?slot=${uniqueSlot()}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  const safeOffer = page.locator('[data-offered-job-id="job-safe-delivery"]');
  await expect(safeOffer).toBeVisible();
  await safeOffer.tap();

  await waitForBeat(page, "packet-choice");
  await expect(page.locator("#routeRiskChoice")).toHaveAttribute("data-visible", "true");
  await expect(page.locator("#routeRiskChoice button")).toHaveCount(2);
});
