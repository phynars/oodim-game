import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN #1988 — the confirmation envelope is player-visible only when
// the route-risk tray itself receives the WAAPI animation after a real tap.
// Capture Element.animate before the served page loads: the tap below stays
// fully player-driven, while the capture survives the tray's commit re-render.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

type CapturedAnimation = {
  targetId: string;
  duration: number;
  keyframes: unknown;
};

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

test.describe("AFTERSIGN route-risk confirmation feedback — played (#1988)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("a route-risk tap schedules the 180ms envelope on the tapped tray", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    await page.addInitScript(() => {
      type CaptureWindow = Window & {
        __routeRiskConfirmAnimations?: Array<{
          targetId: string;
          duration: number;
          keyframes: unknown;
        }>;
      };
      const captureWindow = window as CaptureWindow;
      captureWindow.__routeRiskConfirmAnimations = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function patchedAnimate(
        keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
        options?: number | KeyframeAnimationOptions,
      ): Animation {
        if (this.id === "routeRiskChoice") {
          const duration =
            typeof options === "number" ? options : Number(options?.duration ?? 0);
          captureWindow.__routeRiskConfirmAnimations?.push({
            targetId: this.id,
            duration,
            keyframes,
          });
        }
        return animate.call(this, keyframes, options);
      };
    });

    const slot = `route-risk-confirm-feedback-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    const routeButton = tray
      .locator("button[data-aftersign-tap-choice]:not([disabled])")
      .first();
    await expect(routeButton).toBeVisible({ timeout: WAIT_MS });
    await routeButton.tap();

    const animations = await page.evaluate(() =>
      (
        window as Window & {
          __routeRiskConfirmAnimations?: CapturedAnimation[];
        }
      ).__routeRiskConfirmAnimations ?? [],
    );
    expect(animations).toContainEqual(
      expect.objectContaining({ targetId: "routeRiskChoice", duration: 180 }),
    );
  });
});
