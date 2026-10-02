import { expect, test, type Page } from "@playwright/test";

// Phone-played regression guard: use Chromium's touch input protocol rather
// than Playwright's tap helper or the window.__game input bridge.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

type Snapshot = { scene?: { ready?: boolean; beat?: string } };

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean; beat?: string };
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

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat ?? null),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function nativeTouchTap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled({ timeout: WAIT_MS });

  const box = await target.boundingBox();
  if (!box) throw new Error(`No touch target box for ${selector}`);

  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}

test.describe("AFTERSIGN phone native touch playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("native phone touch advances the visible packet UI button", async ({ page }) => {
    test.setTimeout(90_000);
    const slot = `phone-native-touch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    await nativeTouchTap(page, "#packetButton");

    await waitForBeat(page, "packet-choice");
  });
});
