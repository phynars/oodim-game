import { expect, test } from "@playwright/test";

// AFTERSIGN — player-played motion-accessibility contract for the M-LOOP's
// first tactile decision. The job choice remains visibly actionable, but its
// press feedback must not translate the screen when motion is reduced.
//
// Feel budget: 80ms press/squash; reduced motion: 0px positional movement.
// This uses only a real touch/click on the rendered offer — __game is never
// used to cause the action.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("reduced-motion job offer confirms a real tap without lateral movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/aftersign/?slot=job-offer-reduced-motion-${Date.now()}`, {
    waitUntil: "load",
  });

  const offers = page.locator("#offeredJobs");
  await expect(offers).toBeVisible();

  const offer = offers.getByRole("button").first();
  await expect(offer).toBeVisible();

  const before = await offer.boundingBox();
  expect(before).not.toBeNull();

  await offer.click();

  // The choice is still a real, visible interaction: its offered state leaves
  // the page after the tap. No harness input bridge is involved.
  await expect(offers).not.toContainText(/accept delivery/i, { timeout: 1_000 });

  const after = await offer.boundingBox();
  if (after) {
    // A reduced-motion confirmation may change copy/state, never position.
    expect(Math.abs(after.x - before!.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(after.y - before!.y)).toBeLessThanOrEqual(0.5);
  }
});
