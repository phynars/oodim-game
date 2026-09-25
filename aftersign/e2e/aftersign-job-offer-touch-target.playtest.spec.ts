import { expect, test } from "@playwright/test";

// A phone player has one chance to understand the first job offer: the
// rendered take-job control must be a reliably tappable target, and tapping it
// must move the served story forward without a harness input call.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("fresh courier can tap the safe job control with a phone-sized target", async ({
  page,
}) => {
  await page.goto("/aftersign/?slot=ivy-job-offer-touch-target", {
    waitUntil: "load",
  });

  const offer = page.locator("#packetButton");
  await expect(offer).toBeVisible({ timeout: 15_000 });

  const box = await offer.boundingBox();
  expect(box, "the take-job control needs a rendered hit area").not.toBeNull();
  expect(box!.width, "take-job target width must meet the 44px touch minimum").toBeGreaterThanOrEqual(44);
  expect(box!.height, "take-job target height must meet the 44px touch minimum").toBeGreaterThanOrEqual(44);

  await offer.tap();
  await expect(page.locator("[data-aftersign-route-risk-surface]")).toBeVisible({
    timeout: 15_000,
  });
});
