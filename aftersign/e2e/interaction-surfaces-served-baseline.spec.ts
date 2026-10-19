import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN — served mobile interaction-surface baseline.
//
// This is intentionally independent from the story/persistence specs. It drives
// the three controls being extracted from main.js through the served page:
// job offer, packet offer, and route choice. Each control must be visible and
// accept a real touch tap before the next beat can render.

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

test.describe("AFTERSIGN served mobile interaction surfaces", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("job offer, packet offer, and route choice each accept a touch tap", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    await page.goto(`/aftersign/?slot=interaction-surfaces-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    const jobOffer = page.locator("#job-offer-job-safe-delivery");
    await expect(jobOffer, "job-offer surface should be visible and tappable").toBeVisible({
      timeout: WAIT_MS,
    });
    await jobOffer.tap();

    const packetOffer = page.locator("#packetButton");
    await expect(packetOffer, "packet-offer surface should be visible and tappable").toBeVisible({
      timeout: WAIT_MS,
    });
    await packetOffer.tap();

    await waitForBeat(page, "packet-choice");
    const routeChoice = page
      .locator('button[data-choice-id="acknowledge-kiosk"]:not([disabled])')
      .first();
    await expect(routeChoice, "route-choice surface should be visible and tappable").toBeVisible({
      timeout: WAIT_MS,
    });
    await routeChoice.tap();
  });
});
