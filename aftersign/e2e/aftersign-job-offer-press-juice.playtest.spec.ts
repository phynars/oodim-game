import { expect, test } from "@playwright/test";

// AFTERSIGN job-offer PRESS JUICE — played, not driven.
//
// This locks the tactile promise on the first memory-gated job button itself:
// a real phone tap should produce a short press/recovery envelope on the served
// element the player touches. `window.__game` may be read for state later, but
// this spec never uses it to cause input.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const PRESS_FEEL = {
  pressWindowMs: 120,
  recoveryWindowMs: 420,
  minPressedScaleDrop: 0.015,
  maxPressedScaleDrop: 0.08,
  maxTravelPx: 6,
};

test.describe("AFTERSIGN job-offer press juice", () => {
  test.use({
    viewport: PHONE_VIEWPORT,
    hasTouch: true,
    isMobile: true,
  });

  test("a tappable job offer compresses briefly and recovers", async ({ page }) => {
    await page.goto("/");

    const jobButton = page.locator("[data-aftersign-job-take]").first();
    await expect(jobButton).toBeVisible();
    await expect(jobButton).toBeEnabled();

    const before = await measureButton(page, jobButton);
    expect(before.width).toBeGreaterThan(32);
    expect(before.height).toBeGreaterThan(24);

    const center = {
      x: before.left + before.width / 2,
      y: before.top + before.height / 2,
    };

    await page.touchscreen.tap(center.x, center.y);
    await page.waitForTimeout(PRESS_FEEL.pressWindowMs);

    const pressed = await measureButton(page, jobButton);
    const pressedScaleX = pressed.width / before.width;
    const pressedScaleY = pressed.height / before.height;
    const pressedScale = Math.min(pressedScaleX, pressedScaleY);
    const scaleDrop = 1 - pressedScale;
    const pressedTravel = Math.hypot(pressed.centerX - before.centerX, pressed.centerY - before.centerY);

    expect(scaleDrop).toBeGreaterThanOrEqual(PRESS_FEEL.minPressedScaleDrop);
    expect(scaleDrop).toBeLessThanOrEqual(PRESS_FEEL.maxPressedScaleDrop);
    expect(pressedTravel).toBeLessThanOrEqual(PRESS_FEEL.maxTravelPx);

    await page.waitForTimeout(PRESS_FEEL.recoveryWindowMs);

    const recovered = await measureButton(page, jobButton);
    const recoveredScaleX = recovered.width / before.width;
    const recoveredScaleY = recovered.height / before.height;
    const recoveredTravel = Math.hypot(recovered.centerX - before.centerX, recovered.centerY - before.centerY);

    expect(Math.abs(1 - recoveredScaleX)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(1 - recoveredScaleY)).toBeLessThanOrEqual(0.01);
    expect(recoveredTravel).toBeLessThanOrEqual(1.5);
  });
});

async function measureButton(page, locator) {
  return await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  });
}
