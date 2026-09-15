import { expect, test } from "@playwright/test";

const PHONE = { width: 390, height: 844 };

test.describe("AFTERSIGN scene transition", () => {
  test.use({ viewport: PHONE });

  test("a player tap mounts the kiosk-to-Io transition with the shipped feel envelope", async ({ page }) => {
    await page.goto("/");

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();

    await packetButton.click();

    const choice = page.locator("button").filter({ hasText: /seal|open/i }).first();
    await expect(choice).toBeVisible();
    await choice.click();

    const transition = page.locator(".aftersign-scene-transition");
    await expect(transition).toBeAttached();

    await expect(transition).toHaveAttribute("data-total-duration-ms", "540");
    await expect(transition).toHaveAttribute("data-peak-camera-drift-px", "9");
    await expect(transition).toHaveAttribute("data-peak-camera-roll-deg", "0.5");
    await expect(transition).toHaveAttribute("data-peak-vignette-alpha", "0.18");
    await expect(transition).toHaveAttribute("data-peak-bloom-alpha", "0.26");
    await expect(transition).toHaveAttribute("data-audio-recognition-settle-hz", "196");
    await expect(transition).toHaveAttribute("data-audio-job-offer-rise-hz", "294");
    await expect(transition).toHaveAttribute("data-audio-route-commit-hz", "392");

    await expect(page.locator("#dialogue")).toContainText(/Io/i);
  });
});
