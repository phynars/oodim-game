import { expect, test } from "@playwright/test";

const WAIT_MS = 10_000;

test.describe("AFTERSIGN kept-seal route risk", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a kept seal offers a route, not recovery from a loss", async ({ page }) => {
    const slot = `kept-seal-route-risk-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    // The player reaches the route tray through the visible job offer and
    // packet controls; no harness input drives this outcome.
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await expect(page.locator('[data-beat-id="packet-choice"]')).toBeVisible({ timeout: WAIT_MS });

    const tray = page.locator("#routeRiskChoice");
    await expect(
      tray.locator('button[data-aftersign-tap-choice="repair-the-loss"]'),
      "a sealed packet has not created a loss to repair",
    ).toHaveCount(0);
    await expect(
      tray.locator('button[data-aftersign-tap-choice="take-the-long-way"]'),
    ).toBeVisible({ timeout: WAIT_MS });
  });
});
