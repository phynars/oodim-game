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

/**
 * A player can only read/tap an offer if it is unclipped on screen: fully in
 * the viewport AND the topmost element at its top and bottom edges (so no
 * scroll clip, panel edge or "Deliver packet" row covers it). `toBeVisible`
 * alone passes for clipped / off-screen nodes, which is the #2848 bug.
 */
async function expectFullyReadable(page: Page, selector: string, label: string): Promise<void> {
  const offer = page.locator(selector);
  await expect(offer, `${label} must be fully inside the 390x844 viewport`).toBeInViewport({ ratio: 1 });
  await expect
    .poll(
      () =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return "missing";
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2;
          for (const y of [r.top + 2, r.bottom - 2]) {
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(hit === el || el.contains(hit))) {
              return `covered at y=${Math.round(y)} by ${hit ? hit.tagName + "#" + hit.id + "." + hit.className : "nothing"}`;
            }
          }
          return "readable";
        }, selector),
      { message: `${label} must not be clipped or covered`, timeout: WAIT_MS },
    )
    .toBe("readable");
}

async function wheelTray(page: Page): Promise<void> {
  const tray = page.locator("#offeredJobs");
  const box = await tray.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 40));
  await page.mouse.wheel(0, 700);
}

test.describe("second job list phone scroll", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("shows the complete Night transfer offer at 390x844", async ({ page }) => {
    await reachSecondJobList(page);
    await expectFullyReadable(page, "#job-offer-job-night-transfer", "Night transfer");
  });

  test("reveals Signed receipt by scrolling the rendered list at 390x844", async ({ page }) => {
    await reachSecondJobList(page);
    await wheelTray(page);
    await expectFullyReadable(page, "#job-offer-job-signed-receipt", "Signed receipt");
  });

  test("selects Signed receipt by tapping its visible control after scrolling", async ({ page }) => {
    await reachSecondJobList(page);
    await wheelTray(page);
    await expectFullyReadable(page, "#job-offer-job-signed-receipt", "Signed receipt");
    await page.locator("#job-offer-job-signed-receipt").tap();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __game?: { player?: { selectedJobOfferId?: unknown } } }).__game?.player
              ?.selectedJobOfferId,
        ),
      )
      .toBe("job-signed-receipt");
  });
});
