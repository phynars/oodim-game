import { expect, test, type Page } from "@playwright/test";

// The job offer is the first player commitment in a round. This is deliberately
// played through the visible phone target: __game is read only to prove that
// the touch was not swallowed while the offer surface rerendered.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type Snapshot = {
  scene?: { ready?: boolean; beat?: string };
};

declare global {
  interface Window {
    __game?: {
      getSnapshot?: () => Snapshot;
    };
  }
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat),
      { timeout: WAIT_MS, intervals: [100, 250, 500, 1000] },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN job offer advances by phone touch", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a browser-routed touch on the visible offer reaches packet choice", async ({ page }) => {
    test.setTimeout(90_000);
    const slot = `job-offer-advance-${Date.now()}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await expect
      .poll(
        () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.ready === true),
        { timeout: WAIT_MS },
      )
      .toBe(true);
    await waitForBeat(page, "packet-offered");

    const offer = page.locator("#packetButton");
    await expect(offer).toBeVisible({ timeout: WAIT_MS });
    await expect(offer).toBeEnabled({ timeout: WAIT_MS });

    // Send a real Chrome DevTools Protocol touch sequence at the rendered
    // target rather than calling DOM handlers or the game input contract.
    const box = await offer.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await waitForBeat(page, "packet-choice");
    await expect(page.locator("[data-aftersign-route-risk-surface]")).toBeVisible({
      timeout: WAIT_MS,
    });
  });
});
