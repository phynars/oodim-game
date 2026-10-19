import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

test.describe("AFTERSIGN served mobile interaction baseline", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tap-to-talk packet and delivery buttons advance the served story", async ({ page }) => {
    await page.goto(`/aftersign/?slot=mobile-input-baseline-${Date.now()}`, {
      waitUntil: "load",
    });

    const line = page.locator("#line");
    await expect.poll(() => line.getAttribute("data-beat-id"), { timeout: WAIT_MS }).toBe("packet-offered");

    await page.locator("#packetButton").tap();
    await expect.poll(() => line.getAttribute("data-beat-id"), { timeout: WAIT_MS }).toBe("packet-choice");

    await page.locator("#deliverButton").tap();
    await expect.poll(() => line.getAttribute("data-beat-id"), { timeout: WAIT_MS }).toBe("io-return-recognition");
  });
});
