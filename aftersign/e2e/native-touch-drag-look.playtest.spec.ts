import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type Snapshot = {
  scene?: { ready?: boolean };
  player?: { facingRadians?: number };
};

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean };
      getSnapshot?: () => Snapshot;
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => Boolean(window.__game?.scene?.ready && window.__game?.getSnapshot),
    undefined,
    { timeout: WAIT_MS },
  );
}

test.describe("AFTERSIGN native-touch drag look", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a browser-routed one-finger drag on the rendered scene turns the player", async ({ page }) => {
    test.setTimeout(90_000);
    const slot = `native-touch-drag-look-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);

    const scene = page.locator("#scene");
    await expect(scene).toBeVisible({ timeout: WAIT_MS });
    const box = await scene.boundingBox();
    expect(box, "#scene must have a bounding box").not.toBeNull();
    if (!box) return;

    const facingBefore = await page.evaluate(
      () => window.__game?.getSnapshot?.().player?.facingRadians ?? null,
    );
    expect(facingBefore, "the published snapshot must expose player facing").not.toBeNull();

    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 96, y, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect
      .poll(
        () => page.evaluate(() => window.__game?.getSnapshot?.().player?.facingRadians ?? null),
        { timeout: WAIT_MS },
      )
      .not.toBe(facingBefore);
  });
});
