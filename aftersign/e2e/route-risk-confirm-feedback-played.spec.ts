import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN #1988 — the 180ms route-risk commitment acknowledgement must
// animate the rendered tray the player tapped, not a button, document, or
// detached node. Capture Element.animate because the tap commits and reflows
// the tray in the same handler, so post-tap getAnimations() is not reliable.

const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
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

  test("a route-risk tap schedules the 180ms envelope on #routeRiskChoice", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `route-risk-confirm-feedback-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    await page.evaluate(() => {
      const calls: Array<{ targetId: string; duration: number | null }> = [];
      const originalAnimate = Element.prototype.animate;
      Element.prototype.animate = function (...args: Parameters<Element["animate"]>) {
        const timing = args[1];
        calls.push({
          targetId: (this as HTMLElement).id,
          duration: typeof timing === "number" ? timing : timing?.duration ?? null,
        });
        return originalAnimate.apply(this, args);
      };
      (window as typeof window & { __routeRiskConfirmAnimationCalls?: typeof calls })
        .__routeRiskConfirmAnimationCalls = calls;
    });

    const tray = page.locator("#routeRiskChoice");
    const choice = tray.locator("button[data-aftersign-tap-choice]:not([disabled])").first();
    await expect(choice).toBeVisible({ timeout: WAIT_MS });
    await choice.tap();

    await expect.poll(async () => page.evaluate(() =>
      (window as typeof window & { __routeRiskConfirmAnimationCalls?: unknown[] })
        .__routeRiskConfirmAnimationCalls?.length ?? 0,
    )).toBeGreaterThan(0);
    await expect(page.evaluate(() =>
      (window as typeof window & {
        __routeRiskConfirmAnimationCalls?: Array<{ targetId: string; duration: number | null }>;
      }).__routeRiskConfirmAnimationCalls,
    )).resolves.toContainEqual({ targetId: "routeRiskChoice", duration: 180 });
  });
});
