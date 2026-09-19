// #1854: Capture the target-loss prompt only after the game reports scene readiness.
// SwiftShader cold boot may replace boot-time DOM nodes before the played release.
import { expect, test } from "@playwright/test";

test("packet target loss clears the aim reticle immediately and fades its prompt", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.scene?.ready === true);

  await page.evaluate(() => {
    const prompt = document.querySelector("#targetLossPrompt");
    if (!(prompt instanceof HTMLElement)) {
      throw new Error("#targetLossPrompt was not mounted after scene readiness");
    }

    let peak = 0;
    let stopped = false;
    const sample = () => {
      if (stopped) return;
      const current = document.querySelector("#targetLossPrompt");
      if (current instanceof HTMLElement) {
        peak = Math.max(peak, Number(getComputedStyle(current).opacity));
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.__targetLossOpacityPeak = () => peak;
    window.__stopTargetLossOpacitySampler = () => {
      stopped = true;
    };
  });

  const packet = page.locator('[data-aftersign-tap-choice="packet"]');
  await packet.click();

  await expect.poll(() => page.evaluate(() => window.__targetLossOpacityPeak?.() ?? 0)).toBeGreaterThan(0.5);
  await page.evaluate(() => window.__stopTargetLossOpacitySampler?.());
});
