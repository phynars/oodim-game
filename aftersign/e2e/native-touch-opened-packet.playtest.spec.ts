import { expect, test, type Page } from "@playwright/test";

// Phone-played regression guard with a NATIVE CDP touch stream: the
// opened-packet path advances through a browser-routed touch sequence
// on `#packetButton`, not a synthetic PointerEvent injected inside
// `page.evaluate`. This covers the one gap the shared
// `performPacketGesture` helper leaves open — that helper dispatches
// pointer events from the page context, which skips the touch adapter
// path on the C++ side. CDP `Input.dispatchTouchEvent` goes through
// that adapter.
//
// The rest of the flow (packet-choice → packet-delivered →
// io-return-recognition) uses the same rendered-control taps as
// `io-recognition-return-visual-feel.spec.ts` — the differentiator is
// strictly the open gesture.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;
// Cold-start budget: webkit's first boot of the aftersign bundle sits
// in the 30-60s band in CI, so Playwright's default 30s test timeout
// is too short. 90s matches the sibling WebGL specs
// (`flagship-surface-contract.spec.ts`,
// `io-recognition-return-visual-feel.spec.ts`,
// `aftersign-packet-offer-touch.playtest.spec.ts`).
const COLD_START_MS = 90_000;

type Snapshot = {
  scene?: { ready?: boolean; beat?: string };
  packet?: { sealed?: boolean };
  interaction?: { packetIntent?: { active?: boolean } };
};

declare global {
  interface Window {
    __game?: {
      scene?: { ready?: boolean; beat?: string };
      story?: { memoryBeat?: { outcome?: "sealed" | "opened" } | null };
      getSnapshot?: () => Snapshot;
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  // Mirror `aftersign-packet-offer-touch.playtest.spec.ts`'s readiness
  // gate: don't start probing beat state until the runtime has
  // installed `getSnapshot` AND `scene.ready` is true. Without this
  // the first `waitForFunction` races the bundle boot and times out
  // on cold CI runs.
  await page.waitForFunction(
    () => Boolean(window.__game?.scene?.ready && window.__game?.getSnapshot),
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  // Beat lives at `state.scene.beat` (see
  // `aftersign/src/runtime/inputAdapters.js` + every sibling spec).
  // The previous revision read `state.story.beat`, which does not
  // exist on the published snapshot — that was the 60s timeout.
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene?.beat ?? null),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN native-touch opens the packet", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a browser-routed touch can open the packet and reach IO's broken-seal recognition", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `native-touch-opened-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toBeVisible({ timeout: WAIT_MS });
    await expect(packetButton).toBeEnabled({ timeout: WAIT_MS });
    const box = await packetButton.boundingBox();
    expect(box, "#packetButton must have a bounding box").not.toBeNull();
    if (!box) return;

    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // 1) Touch down on the visible packet.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });

    // 2) State-quiesced wait: don't inject the pull until the touch
    //    adapter has actually recognized the press.
    //    `interaction.packetIntent.active` flips true once
    //    `PacketIntentController.press()` accepts the press (see
    //    `aftersign/src/runtime/inputAdapters.js` which reads
    //    `state.interaction.packetIntent.active`). This is a real
    //    state check, not a blind sleep.
    await page.waitForFunction(
      () =>
        window.__game?.getSnapshot?.().interaction?.packetIntent?.active === true,
      undefined,
      { timeout: WAIT_MS },
    );

    // 3) Pull 12px — inside (OPEN_PULL_MIN_PX=10, DRIFT_CANCEL_PX=14].
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 12, y, id: 1 }],
    });

    // 4) Hold-to-open is physical: `PacketIntentController.release()`
    //    only commits OPENED when `heldMs >= HOLD_TO_OPEN_MS` (450ms).
    //    The controller has no snapshot field exposing "wall time
    //    elapsed", so this hold is a genuine pacing step; 500ms
    //    crosses the 450ms gate with a 50ms margin.
    // allowed: packet hold-to-open gate is a physical 450ms threshold
    await page.waitForTimeout(500);

    // 5) Release — commits OPENED on the touch adapter path.
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    // Beat has advanced out of `packet-offered` into `packet-choice`,
    // and `state.packet.sealed` is false (opened branch). This is the
    // actual proof that the CDP touch stream drove the OPENED outcome.
    await waitForBeat(page, "packet-choice");
    await expect
      .poll(() => page.evaluate(() => window.__game?.getSnapshot?.().packet?.sealed))
      .toBe(false);

    // From here the flow matches `io-recognition-return-visual-feel`'s
    // `playToRecognition`:
    //   skip-kiosk-acknowledge (keeps routeListened=false) →
    //   deliver-packet → packet-delivered → auto-advance into
    //   io-return-recognition on deliverPacket()'s ~1180ms setTimeout.
    // The `:not([disabled])` guard waits past the brief enter-animation
    // when the button exists but hasn't become interactive yet.
    const acknowledgeChoice = page
      .locator('button[data-choice-id="skip-kiosk-acknowledge"]:not([disabled])')
      .first();
    await expect(acknowledgeChoice).toBeVisible({ timeout: WAIT_MS });
    await acknowledgeChoice.tap();

    const deliverChoice = page
      .locator('button[data-choice-id="deliver-packet"]:not([disabled])')
      .first();
    await expect(deliverChoice).toBeVisible({ timeout: WAIT_MS });
    await deliverChoice.tap();

    await waitForBeat(page, "packet-delivered");
    await waitForBeat(page, "io-return-recognition");

    // Durable proof the opened branch landed: `story.memoryBeat.outcome`
    // is published by deliverPacket() when recognition fires (see
    // `docs/flagship/io-recognition-beat.md` and
    // `apps/web/src/aftersign/aftersignPlayedAcceptanceNaming.test.ts`).
    await expect
      .poll(() =>
        page.evaluate(() => window.__game?.story?.memoryBeat?.outcome ?? null),
      )
      .toBe("opened");
  });
});
