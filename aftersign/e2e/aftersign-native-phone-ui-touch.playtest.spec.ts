import { expect, test, type Page } from "@playwright/test";

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

test.describe("AFTERSIGN native phone UI touch", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a browser-routed touch on the rendered packet button reaches packet choice", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const slot = `native-phone-ui-touch-${Date.now()}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await expect
      .poll(
        () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.ready === true),
        { timeout: WAIT_MS },
      )
      .toBe(true);
    await waitForBeat(page, "packet-offered");

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
    await expect(packetButton).toBeEnabled({ timeout: WAIT_MS });
    const box = await packetButton.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Visible packet button has no touch target bounds");

    const client = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
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
