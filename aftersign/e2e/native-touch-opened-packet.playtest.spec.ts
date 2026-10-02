import { expect, test } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;
// Cold-start budget mirrors the sibling aftersign played specs
// (`flagship-surface-contract.spec.ts:15`, `io-phone-ready-look-sound-contract.spec.ts:7`,
// etc.) — webkit's first boot of the aftersign bundle regularly sits
// in the 30-60s band in CI, and the default Playwright test timeout of
// 30s was the actual cause of the "Test timeout of 30000ms exceeded"
// failure on this spec's first push (see the WebGL e2e failure
// summary posted to PR #2089). Raising to 90s matches the existing
// cold-start budget for every aftersign WebGL spec that boots the
// full stack.
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
    // State-quiesced wait: don't inject the pull until the browser
    // actually recognized the pointerdown — `packetIntent.active` flips
    // true inside `aftersign/src/runtime/inputAdapters.js:152` only once
    // the press was accepted by `PacketIntentController.press()`. This
    // replaces a blind 450ms sleep with a real state check, matching
    // the no-wall-clock-waits guard spec in
    // `e2e-shared/no-wall-clock-waits/README.md`.
    await page.waitForFunction(
      () => window.__game?.getSnapshot?.().interaction?.packetIntent?.active === true,
      undefined,
      { timeout: WAIT_MS },
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 12, y, id: 1 }],
    });
    // The hold-to-open contract is physical: `release()` in
    // `aftersign/src/packetIntent.ts:208-215` commits OPENED iff
    // `heldMs = releaseTimeMs - pressTimeMs >= HOLD_TO_OPEN_MS` (450ms)
    // AND `pullPx >= OPEN_PULL_MIN_PX` (10 — the move above injected 12).
    // There is NO continuous `.tick()` loop in `aftersign/main.js`
    // advancing the controller between pointer events (grep'd: zero
    // callers), so `progress` only mutates on move/release and no
    // snapshot field exposes "enough wall time has accumulated yet"
    // ahead of the release. The hold is a genuine wall-clock pacing
    // step — 500ms crosses the 450ms gate with a 50ms margin, matching
    // the 900ms hold shape in
    // `aftersign/e2e/helpers/packetGesture.ts:performPacketGesture`.
    // The 500ms sleep below is the hold itself — see the comment block
    // right above for the full justification against the controller's
    // 450ms + 10px two-axis OPEN contract.
    // allowed: packet hold-to-open gate is a physical 450ms threshold
    await page.waitForTimeout(500);
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
