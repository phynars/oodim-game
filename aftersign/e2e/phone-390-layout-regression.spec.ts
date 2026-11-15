import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

test.describe("AFTERSIGN phone 390×844 round-two offer layout (#2828)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("keeps every round-two offer in the viewport and selects it by centre tap", async ({ page }) => {
    // Three full plays to round two (layout check + one per centre tap).
    test.setTimeout(120_000);

    async function reachRoundTwo(slot: string): Promise<void> {
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await page.waitForFunction(
        () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
        undefined,
        { timeout: WAIT_MS },
      );
      await waitForBeat(page, "packet-offered");
      await page.locator("#job-offer-job-safe-delivery").tap();
      await page.locator("#packetButton").tap();
      await tapChoice(page, "acknowledge-kiosk");
      await tapChoice(page, "deliver-packet");
      await waitForBeat(page, "io-return-recognition");
      const returnReason = page.locator('button[data-return-reason="blunt"]:not([disabled])').first();
      await expect(returnReason).toBeVisible({ timeout: WAIT_MS });
      await returnReason.tap({ force: true });
      await waitForBeat(page, "return-tone-choice");
      await tapChoice(page, "ask-for-next-job");
      await waitForBeat(page, "io-next-job");
      await tapChoice(page, "deliver-packet");
      await waitForBeat(page, "packet-offered");
    }

    const slot = `phone-390-offer-layout-${Date.now()}`;
    await reachRoundTwo(slot);
    const offers = page.locator("#offeredJobs button[data-offered-job-id]");
    await expect(offers).toHaveCount(2);
    // overflow-x stays hidden, so computed overflow-y resolves to "auto";
    // the regression guard is that the 42vh tray clip is gone.
    await expect(page.locator("#offeredJobs")).toHaveCSS("max-height", "none");
    for (const offer of await offers.all()) {
      const box = await offer.boundingBox();
      expect(box, "offered job must have a rendered bounding box").not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
    }

    // Each real centre-tap is replayed from the visible round-two board.
    for (const jobId of ["job-night-transfer", "job-signed-receipt"]) {
      await reachRoundTwo(`${slot}-${jobId}`);
      const offer = page.locator(`#job-offer-${jobId}`);
      const box = await offer.boundingBox();
      expect(box).not.toBeNull();
      await offer.tap({ position: { x: box!.width / 2, y: box!.height / 2 } });
      await expect(page.locator("#packetButton")).toBeVisible({ timeout: WAIT_MS });
    }
  });
});
