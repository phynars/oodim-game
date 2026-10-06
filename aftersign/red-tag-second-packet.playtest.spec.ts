// Regression contract for #2201.
//
// The served round-two path must retain the route identity selected by the
// player. This file is intentionally written before the renderer patch so the
// failing assertion can be wired into the existing AFTERSIGN Playwright runner
// alongside the current two-round journey spec.
import { test, expect } from "@playwright/test";

test("red-tag packet remains red-tag after the player takes it", async ({ page }) => {
  await page.goto("/aftersign/?slot=red-tag-round-two-regression");

  await page.locator("#deliverButton").click();
  await page.locator("#acknowledgeRouteButton").click();
  await page.locator("#deliverButton").click();
  await page.locator('[data-choice-id="accept-second-packet"]').click();

  const packet = page.locator("#packetButton");
  await expect(packet).toContainText(/red tag.*saint orra/i);
  await packet.click();
  await expect(packet).toContainText(/red tag.*saint orra/i);

  await page.locator("#deliverButton").click();
  await expect(page.locator("#ioLine")).toContainText(/red tag.*saint orra/i);
});
