import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

test.describe("AFTERSIGN packet seal confirmation", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a player tap visibly confirms the kept seal", async ({ page }) => {
    await page.goto(`/aftersign/?slot=packet-seal-feedback-${Date.now()}`, {
      waitUntil: "load",
    });

    const packet = page.locator("#packetButton");
    await expect(packet).toBeVisible({ timeout: WAIT_MS });
    await packet.tap();

    await expect(packet).toHaveAttribute("data-packet-button-copy-state", "sealed");
    await expect(packet).toContainText(/seal intact/i);
    await expect(packet).toContainText(/your choice is locked/i);
    await expect(packet).toHaveCSS("border-top-color", "rgba(141, 205, 255, 0.96)");
  });
});
