import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: {
      getSnapshot?: () => { scene?: { ready?: boolean; beat?: string } };
    };
  }
}

test.describe("AFTERSIGN packet button touch-target contract", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("#packetButton has a 44 CSS-pixel rendered touch target", async ({ page }) => {
    test.setTimeout(90_000);
    const slot = `packet-button-touch-target-${Date.now()}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await expect
      .poll(
        () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.ready === true),
        { timeout: WAIT_MS },
      )
      .toBe(true);
    await expect
      .poll(
        () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat),
        { timeout: WAIT_MS, intervals: [100, 250, 500, 1000] },
      )
      .toBe("packet-offered");

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
    const box = await packetButton.boundingBox();

    expect(box, "packetButton must have a rendered hit area").not.toBeNull();
    expect(box!.width, "packetButton width must meet the 44px touch minimum").toBeGreaterThanOrEqual(44);
    expect(box!.height, "packetButton height must meet the 44px touch minimum").toBeGreaterThanOrEqual(44);
  });
});
