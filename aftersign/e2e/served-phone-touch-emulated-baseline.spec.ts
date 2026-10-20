import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const COLD_START_MS = 90_000;
const WAIT_MS = 30_000;

async function waitForBeat(page: import("@playwright/test").Page, beatId: string): Promise<void> {
  await expect.poll(() => page.locator("#line").getAttribute("data-beat-id"), { timeout: WAIT_MS }).toBe(beatId);
}

test.describe("AFTERSIGN served phone touch-emulated baseline", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tap-to-talk, HUD delivery, and move-pad drag publish player-visible outcomes", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await page.goto(`/aftersign/?slot=served-phone-touch-${Date.now()}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    await page.locator("#deliverButton").tap();
    await waitForBeat(page, "io-return-recognition");

    const pad = page.locator("#movePad");
    await expect(pad).toBeVisible({ timeout: WAIT_MS });
    const box = await pad.boundingBox();
    expect(box).not.toBeNull();

    const before = await page.evaluate(() => window.__game.getSnapshot());
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 54, centerY, { steps: 1 });

    await page.waitForFunction(() => {
      const snapshot = window.__game?.getSnapshot();
      return Boolean(
        snapshot?.movement.input.source === "touch" &&
          snapshot.movement.velocityX > 0 &&
          snapshot.cameraRig.lookAt.x > snapshot.player.x,
      );
    }, undefined, { timeout: WAIT_MS });

    const afterDrag = await page.evaluate(() => window.__game.getSnapshot());
    expect(afterDrag.player.x).toBeGreaterThan(before.player.x);
    expect(afterDrag.cameraRig.lookAt.x).toBeGreaterThan(before.cameraRig.lookAt.x);
    await page.mouse.up();
  });
});
