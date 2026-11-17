import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const scene = (window as unknown as {
            __game?: { scene?: { beat?: unknown } };
          }).__game?.scene;
          return typeof scene?.beat === "string" ? scene.beat : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tapVisible(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await control.scrollIntoViewIfNeeded();
  await control.tap();
}

/** Reaches a returning player's second offer tray using rendered controls only. */
async function reachSecondJobList(page: Page): Promise<void> {
  const slot = `second-job-phone-scroll-${Date.now()}-${Math.random()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");

  // The first offer and every continuation are player-visible controls. The
  // test deliberately does not use window.__game to cause a story action.
  // Same visible-control path as job-offers-played.spec.ts (the proven
  // route to the completed-set offers): safe job, packet, kiosk, deliver,
  // return tone, ask for next job, deliver again.
  await tapVisible(page, "#job-offer-job-safe-delivery");
  await tapVisible(page, "#packetButton");
  await waitForBeat(page, "packet-choice");
  await tapVisible(page, 'button[data-choice-id="acknowledge-kiosk"]:not([disabled]) >> nth=0');
  await tapVisible(page, 'button[data-choice-id="deliver-packet"]:not([disabled]) >> nth=0');
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, 'button[data-return-reason="kind"]:not([disabled]) >> nth=0');
  await waitForBeat(page, "return-tone-choice");
  await tapVisible(page, 'button[data-choice-id="ask-for-next-job"]:not([disabled]) >> nth=0');
  await waitForBeat(page, "io-next-job");
  await tapVisible(page, 'button[data-choice-id="deliver-packet"]:not([disabled]) >> nth=0');
  await waitForBeat(page, "packet-offered");
  await expect(page.locator("#job-offer-job-night-transfer")).toBeVisible({
    timeout: WAIT_MS,
  });
}

test.describe("second job list phone scroll", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("shows the complete Night transfer offer at 390x844", async ({ page }) => {
    await reachSecondJobList(page);
    const offer = page.locator("#job-offer-job-night-transfer");
    await expect(offer).toBeVisible();
    const [offerBox, trayBox] = await Promise.all([offer.boundingBox(), page.locator("#offeredJobs").boundingBox()]);
    expect(offerBox).not.toBeNull();
    expect(trayBox).not.toBeNull();
    expect(offerBox!.y).toBeGreaterThanOrEqual(trayBox!.y);
    expect(offerBox!.y + offerBox!.height).toBeLessThanOrEqual(trayBox!.y + trayBox!.height);
  });

  test("reveals Signed receipt by scrolling the rendered list at 390x844", async ({ page }) => {
    await reachSecondJobList(page);
    const tray = page.locator("#offeredJobs");
    const box = await tray.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 700);
    await expect(page.locator("#job-offer-job-signed-receipt")).toBeVisible();
  });

  test("selects Signed receipt by tapping its visible control after scrolling", async ({ page }) => {
    await reachSecondJobList(page);
    const tray = page.locator("#offeredJobs");
    const box = await tray.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 700);
    const offer = page.locator("#job-offer-job-signed-receipt");
    await expect(offer).toBeVisible();
    await offer.tap();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game?: { player?: { selectedJobOfferId?: unknown } } }).__game?.player?.selectedJobOfferId)).toBe("job-signed-receipt");
  });
});
