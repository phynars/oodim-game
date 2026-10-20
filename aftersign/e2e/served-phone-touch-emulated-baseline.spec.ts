import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const COLD_START_MS = 90_000;
const WAIT_MS = 30_000;

async function waitForBeat(page: import("@playwright/test").Page, beatId: string): Promise<void> {
  await expect.poll(() => page.locator("#line").getAttribute("data-beat-id"), { timeout: WAIT_MS }).toBe(beatId);
}

async function dispatchTouchPointer(
  target: import("@playwright/test").Locator,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
): Promise<void> {
  await target.dispatchEvent(type, {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: x,
    clientY: y,
  });
}

test.describe("AFTERSIGN served phone touch-emulated baseline", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tap-to-talk, HUD delivery, touch movement, and drag-look publish independent outcomes", async ({ page }) => {
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

    const beforeMove = await page.evaluate(() => window.__game.getSnapshot());
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    await dispatchTouchPointer(pad, "pointerdown", centerX, centerY);
    await dispatchTouchPointer(pad, "pointermove", centerX + 54, centerY);

    await page.waitForFunction(() => {
      const snapshot = window.__game?.getSnapshot();
      return Boolean(snapshot?.movement.input.source === "touch" && snapshot.movement.velocityX > 0);
    }, undefined, { timeout: WAIT_MS });

    const afterMove = await page.evaluate(() => window.__game.getSnapshot());
    expect(afterMove.player.x).toBeGreaterThan(beforeMove.player.x);
    await dispatchTouchPointer(pad, "pointerup", centerX + 54, centerY);

    const game = page.locator("canvas");
    await expect(game).toBeVisible({ timeout: WAIT_MS });
    const gameBox = await game.boundingBox();
    expect(gameBox).not.toBeNull();
    const beforeLook = await page.evaluate(() => window.__game.getSnapshot());
    const lookX = gameBox!.x + gameBox!.width / 2;
    const lookY = gameBox!.y + gameBox!.height / 2;
    await dispatchTouchPointer(game, "pointerdown", lookX, lookY);
    await dispatchTouchPointer(game, "pointermove", lookX + 54, lookY);
    await dispatchTouchPointer(game, "pointerup", lookX + 54, lookY);

    await page.waitForFunction((before) => {
      const snapshot = window.__game?.getSnapshot();
      return Boolean(
        snapshot &&
          snapshot.player.x === before.playerX &&
          snapshot.cameraRig.lookAt.x > before.lookAtX,
      );
    }, { playerX: beforeLook.player.x, lookAtX: beforeLook.cameraRig.lookAt.x }, { timeout: WAIT_MS });

    const afterLook = await page.evaluate(() => window.__game.getSnapshot());
    expect(afterLook.player.x).toBe(beforeLook.player.x);
    expect(afterLook.cameraRig.lookAt.x).toBeGreaterThan(beforeLook.cameraRig.lookAt.x);
  });
});
