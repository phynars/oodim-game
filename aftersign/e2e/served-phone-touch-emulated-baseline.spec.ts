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

  test("tap-to-talk, HUD delivery, and move-pad touch gesture publish independent outcomes", async ({ page }) => {
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
    // Baseline: before any touch input, the published input source must be
    // "none". If a prior interaction left it as "touch" this spec's
    // during-drag assertion below would be tautological.
    expect(beforeMove.movement.input.source).toBe("none");

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;
    await dispatchTouchPointer(pad, "pointerdown", centerX, centerY);
    await dispatchTouchPointer(pad, "pointermove", centerX + 54, centerY);

    // Independent published outcome #1 (DURING the drag): the move-pad
    // publishes `movement.input.source = "touch"` with a non-zero
    // horizontal velocity while the finger is held. This is attributable
    // to the touch-source gesture itself — it cannot occur without the
    // pointerdown/pointermove on #movePad (see aftersign/src/mobileMovePad.ts
    // publish() — source is "touch" only while `active` is true, and
    // activePointerId is set exclusively by pointerdown on the pad root).
    await page.waitForFunction(() => {
      const snapshot = window.__game?.getSnapshot();
      return Boolean(snapshot?.movement.input.source === "touch" && snapshot.movement.velocityX > 0);
    }, undefined, { timeout: WAIT_MS });

    const duringDrag = await page.evaluate(() => window.__game.getSnapshot());
    expect(duringDrag.movement.input.source).toBe("touch");
    expect(duringDrag.player.x).toBeGreaterThan(beforeMove.player.x);

    // Independent published outcome #2 (ON RELEASE): the move-pad
    // publishes `movement.input.source = "none"` and the touch-source
    // input vector returns to zero. This is attributable to the
    // pointerup on #movePad specifically — nothing else in the served
    // runtime flips `source` back to "none" (mobileMovePad.ts release()
    // is the sole writer). The player's final X staying greater than
    // beforeMove.player.x confirms the earlier translation was real,
    // not an easing artifact.
    await dispatchTouchPointer(pad, "pointerup", centerX + 54, centerY);

    await page.waitForFunction(() => {
      const snapshot = window.__game?.getSnapshot();
      return Boolean(
        snapshot
          && snapshot.movement.input.source === "none"
          && snapshot.movement.input.x === 0
          && snapshot.movement.input.z === 0,
      );
    }, undefined, { timeout: WAIT_MS });

    const afterRelease = await page.evaluate(() => window.__game.getSnapshot());
    expect(afterRelease.movement.input.source).toBe("none");
    expect(afterRelease.player.x).toBeGreaterThan(beforeMove.player.x);
  });
});
