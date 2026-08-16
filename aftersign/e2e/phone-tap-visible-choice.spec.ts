import { test, expect, type Page } from "@playwright/test";

// AFTERSIGN phone-tap progression spec (#1232).
//
// Drives the shipped story slice EXCLUSIVELY through what a phone player
// can see and tap: the `[data-beat-id]` stamp on the story line and the
// `[data-choice-id]` stamps on the visible choice buttons — the DOM
// bridge landed in aftersign/src/playerVisibleBeatDom.js (PR #1231).
// No `window.__game.input.choose(...)` calls in this file, per the
// acceptance criteria on #1232.
//
// ROOT-CAUSE NOTE for the prior red runs on this branch: the earlier
// draft of this spec started by waiting for the "packet-choice" beat.
// A fresh slot BOOTS at "packet-offered" (main.js: state.scene.beat
// defaults to "packet-offered"); "packet-choice" is only reached AFTER
// the player commits a packet gesture — a tap (preserve seal) or hold
// (open) on the #packetButton surface. The old spec never performed
// that gesture, so `waitForAnyBeat(["packet-choice"])` timed out on
// every attempt and retries couldn't save it (deterministic, not
// flake). The fix: tap the packet button first (a REAL pointer
// gesture — pointerdown + quick pointerup = "tap to preserve seal",
// committing SEALED → beat "packet-choice"), then proceed via the
// data-beat-id / data-choice-id taps.
//
// Also fixed: the old spec clicked a "return-to-io" choice at a
// "packet-delivered" beat wait — but after `deliver-packet` the runtime
// transitions packet-delivered → io-return-recognition AUTOMATICALLY
// via a setTimeout (main.js deliverPacket(), 1180ms). There is no
// "return-to-io" [data-choice-id] stamped anywhere in renderText(), so
// that click could never resolve. We simply wait for the recognition
// beat to arrive on its own.
//
// Beat/choice ids below are the ones renderText() actually stamps
// (aftersign/main.js):
//   packet-choice          → acknowledge-kiosk / skip-kiosk-acknowledge / deliver-packet
//   io-return-recognition  → choose-return-tone (×3 tone buttons)
//   return-tone-choice     → ask-for-next-job
//   io-next-job            → deliver-packet (terminal for this spec)

const SPEC_TIMEOUT_MS = 120_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

test.describe("AFTERSIGN phone tap progression via visible DOM selectors", () => {
  test("progresses packet-choice → recognition → tone-choice → next-job via data-beat-id/data-choice-id taps", async ({ page }) => {
    test.setTimeout(SPEC_TIMEOUT_MS);

    await page.goto(`?slot=phone-tap-visible-choice-${Date.now()}`, { waitUntil: "load" });

    // Boot beat is "packet-offered" — the story line carries its
    // data-beat-id stamp as soon as the module's first renderText()
    // runs. Waiting on it also confirms the DOM bridge is live before
    // we drive any input.
    await waitForBeat(page, "packet-offered");

    // Commit the packet gesture the way a phone player does: a quick
    // tap on the visible packet button preserves the seal
    // (PacketIntentController: press + fast release ⇒ SEALED ⇒
    // commitPacketOutcome ⇒ setBeat("packet-choice")). This is the
    // only pre-bridge input surface in the slice; every subsequent
    // step below goes through [data-choice-id] taps.
    await page.locator("#packetButton").click();
    await waitForBeat(page, "packet-choice");

    // Second deliberate kiosk action (visible route-memory buttons),
    // then deliver — both via the stamped choice ids.
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // deliverPacket() auto-advances to the recognition beat after the
    // beat envelope closes (~1180ms) — no player input exists or is
    // needed here; just wait for the beat stamp to flip.
    await waitForBeat(page, "io-return-recognition");
    await tapChoice(page, "choose-return-tone");

    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");

    await waitForBeat(page, "io-next-job");
  });
});
