import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;
// Cold-start budget: webkit's first boot of the aftersign bundle sits in
// the 30-60s band in CI, so Playwright's default 30s test timeout is too
// short. 90s matches the sibling WebGL specs
// (`flagship-surface-contract.spec.ts`, `io-phone-ready-look-sound-contract.spec.ts`).
const COLD_START_MS = 90_000;

test.describe("AFTERSIGN native-touch opens the packet", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a browser-routed touch can open the packet and reach IO's broken-seal recognition", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
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
    // State-quiesced wait: don't inject the pull until the browser has
    // actually recognized the pointerdown. `packetIntent.active` flips
    // true once `PacketIntentController.press()` accepts the press — a
    // real state check instead of a blind sleep.
    await page.waitForFunction(
      () => window.__game?.getSnapshot?.().interaction?.packetIntent?.active === true,
      undefined,
      { timeout: WAIT_MS },
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 12, y, id: 1 }],
    });
    // Hold-to-open is physical: `PacketIntentController.release()` only
    // commits OPENED when `heldMs >= HOLD_TO_OPEN_MS` (450ms) AND
    // `pullPx >= OPEN_PULL_MIN_PX` (10 — the move above injected 12).
    // The controller has no snapshot field exposing "wall time elapsed",
    // so the hold itself is a genuine pacing step; 500ms crosses the
    // 450ms gate with a 50ms margin.
    // allowed: packet hold-to-open gate is a physical 450ms threshold
    await page.waitForTimeout(500);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(page.locator('[data-choice-id="skip-kiosk-acknowledge"]')).toBeVisible({
      timeout: WAIT_MS,
    });
    await expect
      .poll(() => page.evaluate(() => window.__game.getSnapshot().packet.sealed))
      .toBe(false);

    // Sibling specs (aftersign-mloop-two-round, aftersign-packet-recall-feel,
    // flagship-surface-contract…) reach choice buttons as
    // `button[data-choice-id="…"]:not([disabled])` — the `:not([disabled])`
    // guard waits past the brief enter-animation when the button exists
    // but hasn't become interactive yet. Match that pattern here instead
    // of guessing an `#id` that main.js may not render.
    const acknowledgeChoice = page.locator(
      'button[data-choice-id="skip-kiosk-acknowledge"]:not([disabled])',
    );
    await expect(acknowledgeChoice).toBeVisible({ timeout: WAIT_MS });
    await acknowledgeChoice.tap();

    const deliverChoice = page.locator(
      'button[data-choice-id="deliver-packet"]:not([disabled])',
    );
    await expect(deliverChoice).toBeVisible({ timeout: WAIT_MS });
    await deliverChoice.tap();
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
