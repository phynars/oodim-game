import { expect, test } from "@playwright/test";

test("phone sound control can be enabled without blocking the first packet choice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/aftersign/?slot=phone-sound-${Date.now()}`, { waitUntil: "networkidle" });

  const sound = page.locator("#soundButton");
  await expect(sound).toBeVisible();
  await sound.tap();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await expect(sound).toHaveText(/sound on/i);

  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible();
  await packet.tap();
  await expect(page.locator("#deliverButton")).toBeVisible();
});
