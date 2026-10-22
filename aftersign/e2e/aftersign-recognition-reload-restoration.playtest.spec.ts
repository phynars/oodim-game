import { expect, test, type Page, type Locator } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";
import { performPacketGesture } from "./helpers/packetGesture";

// Playtest: after a phone-player reload, the OPENED-packet recognition
// beat restores DIRECTLY to `io-return-recognition` — the shipped
// durable-save contract now persists the auto-advanced beat (see
// aftersign/main.js deliverPacket(): the 1180ms setTimeout calls
// `persistAuthoritative({ dirty: true })` AFTER `setBeat(
// "io-return-recognition")`, closing the window where a reload during
// Io's recognition line restored the stale `packet-delivered` beat).
// Reload therefore lands on `io-return-recognition` with the
// opened-outcome RETURNING-tier line and all three tone controls
// visible — no additional "Return to Io" tap is required.
//
// Coverage complement to aftersign/e2e/aftersign-recognition-reload.playtest.spec.ts:
//   sibling  → outcome=sealed  (RETURNING_LINES.sealed)
//   this one → outcome=opened  (RETURNING_LINES.opened)
// The two lines diverge in aftersign/src/ioRecognitionDialogue.ts:41-45;
// a regression on the opened branch (wrong copy after reload, missing
// tone controls) would slip past the sealed spec.
//
// Runtime premises validated against shipped code on 2026-10-15:
//   1. Sealed vs. opened is chosen by the PACKET GESTURE on the visible
//      `#packetButton`, NOT by a `data-choice-id` button.
//      `open-packet` / `keep-packet-sealed` are dispatch-only ids
//      inside `choose()` (aftersign/main.js:2126) and are NEVER stamped
//      on a rendered control — a `button[data-choice-id="open-packet"]`
//      selector times out because that button does not exist. The played
//      path is `performPacketGesture(page, "opened")` — pointerdown →
//      mid-hold 12px pointermove → pointerup on `#packetButton` — same
//      helper the sibling io-recognition-return-visual-feel.spec.ts
//      uses to reach the opened branch.
//   2. Auto-save fires TWICE in deliverPacket(): once at
//      `packet-delivered` (synchronous call), and once at
//      `io-return-recognition` (inside the 1180ms setTimeout, AFTER
//      `setBeat("io-return-recognition")`). The second write wins;
//      restored beat is `io-return-recognition`.
//   3. `skip-kiosk-acknowledge` keeps `routeListened=false` so the
//      RETURNING tier speaks (deep-recall requires `acknowledge-kiosk`).
//   4. Wait for beats via the rendered `[data-beat-id="…"]` node — the
//      DOM contract asserted by
//      apps/web/src/aftersign/servedSurface.contract.test.ts. There is
//      NO `data-story-beat` attribute on `#aftersign`.
//   5. Timeouts match the sealed sibling (60s per beat, 180s ceiling)
//      because reload re-runs the WebGL cold-start under SwiftShader.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

const OPENED_RECOGNITION_LINE = expectedIoRecognitionLine("opened", false);

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `visible dialogue control for "${choiceId}" should be present`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

test.describe("AFTERSIGN recognition reload restoration (opened)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("restores the opened-packet Io recognition beat after a phone-player reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `recognition-reload-restoration-opened-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    // --- Play from a fresh save to io-return-recognition via the real
    // player surface. The opened branch is reached by holding
    // `#packetButton` with a mid-hold pull — NOT by a choice-id tap.
    await waitForBeat(page, "packet-offered");
    await performPacketGesture(page, "opened", WAIT_MS);

    await waitForBeat(page, "packet-choice");
    // `skip-kiosk-acknowledge` keeps routeListened=false so the
    // RETURNING tier speaks; then `deliver-packet` fires the first
    // auto-save and advances the beat.
    await tapChoice(page, "skip-kiosk-acknowledge");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // Runtime auto-advances into recognition after deliverPacket()'s
    // ~1180ms setTimeout — the SECOND auto-save fires here, pinning
    // `io-return-recognition` as the durable restore target.
    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(OPENED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.locator('button[data-return-reason]:not([disabled])'),
    ).toHaveCount(3, { timeout: WAIT_MS });

    // --- Reload. Both auto-saves have fired; the LATER one
    // (post-`setBeat("io-return-recognition")`) is the one that
    // persists. The phone-player path must restore directly to
    // `io-return-recognition` with the opened-outcome line + full tone
    // controls — no extra tap on "Return to Io" required.
    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(OPENED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.locator('button[data-return-reason]:not([disabled])'),
    ).toHaveCount(3, { timeout: WAIT_MS });
  });
});
