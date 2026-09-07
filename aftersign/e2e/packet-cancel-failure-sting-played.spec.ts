import { expect, test } from "@playwright/test";

const FAILURE_STING_FEEL = {
  durationMs: 180,
  hudShakePx: 8,
  hudDropPx: 2,
  flashAlpha: 0.34,
  easing: "easeOutQuad",
};

test.describe("packet cancel failure sting", () => {
  test("plays a visible 180ms sting when the player cancels the packet drag", async ({ page }) => {
    await page.goto("/");

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible();

    const buttonBox = await packetButton.boundingBox();
    expect(buttonBox, "packet button has a rendered hit target").not.toBeNull();

    const startX = buttonBox!.x + buttonBox!.width / 2;
    const startY = buttonBox!.y + buttonBox!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 34, startY, { steps: 5 });
    await page.mouse.up();

    await expect
      .poll(
        async () =>
          page.evaluate(() => window.__game?.interaction?.lastAction ?? null),
        { message: "packet drag records a player-caused cancellation" },
      )
      .toBe("packet-cancelled");

    const failureFeedback = await page.evaluate(() => {
      const feedback = window.__game?.interaction?.failureFeedback;
      if (!feedback) return null;
      return {
        active: feedback.active,
        kind: feedback.kind,
        durationMs: feedback.durationMs,
        hudShakePx: feedback.hudShakePx,
        hudDropPx: feedback.hudDropPx,
        flashAlpha: feedback.flashAlpha,
        easing: feedback.easing,
      };
    });

    expect(failureFeedback).toMatchObject({
      active: true,
      kind: "packet-cancelled",
      ...FAILURE_STING_FEEL,
    });

    const visibleSting = await page.evaluate(() => {
      const root = document.documentElement;
      const sting = document.querySelector<HTMLElement>(".failure-sting");
      const cssNumber = (name: string) =>
        Number.parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;

      return {
        shakeX: Math.abs(cssNumber("--confirm-shake-x")),
        shakeY: cssNumber("--confirm-shake-y"),
        flashOpacity: sting
          ? Number.parseFloat(getComputedStyle(sting).opacity) || 0
          : 0,
      };
    });

    expect(visibleSting.shakeX).toBeGreaterThan(0);
    expect(visibleSting.shakeX).toBeLessThanOrEqual(FAILURE_STING_FEEL.hudShakePx);
    expect(visibleSting.shakeY).toBeGreaterThanOrEqual(0);
    expect(visibleSting.shakeY).toBeLessThanOrEqual(FAILURE_STING_FEEL.hudDropPx);
    expect(visibleSting.flashOpacity).toBeGreaterThan(0);
    expect(visibleSting.flashOpacity).toBeLessThanOrEqual(FAILURE_STING_FEEL.flashAlpha);

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__game?.interaction?.failureFeedback?.active ?? false,
          ),
        { message: "failure sting releases after its decay window", timeout: 1200 },
      )
      .toBe(false);
  });
});

declare global {
  interface Window {
    __game?: {
      interaction?: {
        lastAction?: string;
        failureFeedback?: {
          active?: boolean;
          kind?: string;
          durationMs?: number;
          hudShakePx?: number;
          hudDropPx?: number;
          flashAlpha?: number;
          easing?: string;
        };
      };
    };
  }
}
