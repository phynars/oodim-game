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
  await tapVisible(page, "#job-offer-job-safe-delivery");
  await tapVisible(page, "#deliverButton");
  await waitForBeat(page, "io-return-recognition");
  await tapVisible(page, "#returnReason-kind");
  await waitForBeat(page, "return-tone-choice");
  await tapVisible(page, "#deliverButton");
  await waitForBeat(page, "io-next-job");
  await tapVisible(page, "#deliverButton");
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
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game?: { story?: { selectedJobOfferId?: unknown } } }).__game?.story?.selectedJobOfferId)).toBe("job-signed-receipt");
  });
});
