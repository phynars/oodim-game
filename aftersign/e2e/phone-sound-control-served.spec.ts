import { expect, test, type Page } from "@playwright/test";

// Soren Vask re-review of #2365:
//   1. `.tap()` needs `hasTouch: true` — the aftersign Playwright config
//      has one "Desktop Chrome" project with no touch, so without this
//      `test.use` the first tap throws "page does not support tap".
//   2. The player sequence out of `packet-offered` is: tap an offered
//      job to SELECT it (does not leave the beat), THEN tap
//      `#packetButton` to advance to `packet-choice`. Jumping straight
//      to `#packetButton` from boot never leaves `packet-offered`.
//   3. `#deliverButton` is static markup in `index.html` and is visible
//      at boot — "visible" cannot witness that the packet tap did
//      anything. The dynamic receipt is the `[data-beat-id="packet-choice"]`
//      node that only appears after the packet confirmation lands.
//
// What this spec guards: the sound toggle at the fresh-boot `packet-offered`
// surface flips its state and label (receipt from `soundButtonSelected.js`)
// AND does not swallow the subsequent offered-job + packet-button taps
// that advance the beat to `packet-choice`.
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

test.describe("AFTERSIGN phone sound control", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("sound toggle at boot flips its label and does not block the first packet choice", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/aftersign/?slot=phone-sound-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    // (1) Tap the sound button FIRST, at the fresh-boot surface. The
    // receipt from `soundButtonSelected.js` is "Kiosk sound on" plus
    // aria-pressed="true" — this is the only proof the click reached
    // the handler (the audio pipeline itself can't be witnessed from
    // Playwright because WebAudio is user-gesture gated).
    const sound = page.locator("#soundButton");
    await expect(sound).toBeVisible({ timeout: WAIT_MS });
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await expect(sound).toHaveText(/sound on/i);

    // (2) The sound tap must not swallow the offered-job selection.
    // Tap a real offered job (the fresh-memory tray stamps
    // `job-safe-delivery`, per `aftersign-mloop-two-round.playtest.spec.ts`).
    const offered = page.locator('button[data-offered-job-id]').first();
    await expect(offered).toBeVisible({ timeout: WAIT_MS });
    await expect(offered).toBeEnabled({ timeout: WAIT_MS });
    await offered.tap();
    // Selection intentionally stays in `packet-offered`; confirmation
    // happens on the packet button below.
    await waitForBeat(page, "packet-offered");

    // (3) Tap `#packetButton` to confirm. The witness is the dynamic
    // `[data-beat-id="packet-choice"]` node — NOT the static
    // `#deliverButton` element, which is painted at boot and would
    // pass "visible" even if the packet tap did nothing.
    const packet = page.locator("#packetButton");
    await expect(packet).toBeVisible({ timeout: WAIT_MS });
    await expect(packet).toBeEnabled({ timeout: WAIT_MS });
    await packet.tap();
    await waitForBeat(page, "packet-choice");

    // Sound state must survive the beat transition — the receipt is
    // durable, not a one-frame flash.
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await expect(sound).toHaveText(/sound on/i);
  });
});
