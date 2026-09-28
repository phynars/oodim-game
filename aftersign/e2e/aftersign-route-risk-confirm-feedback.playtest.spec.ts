import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __routeRiskConfirmFeedback?: Array<{
      elementId: string;
      duration?: unknown;
      transforms: string[];
      serialized: string;
    }>;
  }
}

const WAIT_MS = 15_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

test.describe("AFTERSIGN route-risk confirmation feedback", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a played route choice schedules the 180ms confirmation envelope on the tapped surface", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.addInitScript(() => {
      const recorded: Array<{
        elementId: string;
        duration?: unknown;
        transforms: string[];
        serialized: string;
      }> = [];
      const originalAnimate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        const frames = Array.isArray(keyframes) ? keyframes : [];
        const serialized = JSON.stringify(keyframes);
        const duration =
          typeof options === "object" && options ? options.duration : undefined;
        recorded.push({
          elementId: this.id,
          duration,
          transforms: frames.map((frame) => String(frame.transform ?? "")),
          serialized,
        });
        const animation = originalAnimate.call(this, keyframes, options);
        const effect = animation.effect;
        recorded[recorded.length - 1].transforms =
          effect instanceof KeyframeEffect
            ? effect.getKeyframes().map((frame) => String(frame.transform ?? ""))
            : [];
        window.__routeRiskConfirmFeedback = recorded;
        return animation;
      };
      window.__routeRiskConfirmFeedback = recorded;
    });
    await page.goto(`/aftersign/?slot=route-risk-confirm-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    const safeRoute = page.locator(
      '#routeRiskChoice button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(safeRoute).toBeVisible({ timeout: WAIT_MS });
    await safeRoute.tap();

    // The page immediately re-renders the tray after the tap and can cancel
    // the finished Web Animation before Element.getAnimations() can observe
    // it. Record the browser's real Element.animate call before navigation;
    // the route selection itself remains a player tap on the rendered button.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            (window.__routeRiskConfirmFeedback ?? []).find(
              (entry) =>
                entry.elementId === "routeRiskChoice"
                && entry.duration === 180
                && entry.serialized.includes(
                  "translate3d(0, -4px, 0) scale(1.025)",
                ),
            ),
          ),
        { timeout: 1_000 },
      )
      .toEqual(
        expect.objectContaining({
          duration: 180,
          serialized: expect.stringContaining(
            "translate3d(0, -4px, 0) scale(1.025)",
          ),
        }),
      );
  });
});
