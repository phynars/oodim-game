import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

test.describe("AFTERSIGN native-touch opens the packet", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a browser-routed touch can open the packet and reach IO's broken-seal recognition", async ({
    page,
  }) => {
    const slot = `native-touch-opened-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => window.__game?.getSnapshot?.().story?.beat === "packet-offered",
      undefined,
      { timeout: WAIT_MS },
    );

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
    const box = await packetButton.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await page.waitForTimeout(450);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 12, y, id: 1 }],
    });
    await page.waitForTimeout(450);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(page.locator('[data-choice-id="skip-kiosk-acknowledge"]')).toBeVisible({
      timeout: WAIT_MS,
    });
    await expect
      .poll(() => page.evaluate(() => window.__game.getSnapshot().packet.sealed))
      .toBe(false);

    await page.locator('[data-choice-id="skip-kiosk-acknowledge"]').tap();
    await page.locator("#deliver-packet").tap();
    await page.waitForFunction(
      () => window.__game?.getSnapshot?.().story?.beat === "io-return-recognition",
      undefined,
      { timeout: WAIT_MS },
    );
    await expect
      .poll(() => page.evaluate(() => window.__game.story.memoryBeat.outcome))
      .toBe("opened");
  });
});
