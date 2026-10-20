import { expect, test, type Page, type Locator } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";
import { getAftersignIoRouteReturnLine } from "../../apps/web/src/aftersign/ioFirstSceneDialogue";

// Playtest: after a phone-player reload, the story restores DIRECTLY to
// `io-return-recognition` with the correct returning-tier line + the
// authored return-tone controls — no extra tap required.
//
// This spec is the "reload" companion to
// aftersign/e2e/packet-delivered-cold-boot-affordance.spec.ts — that one
// uses a fresh browser context (cleared storage) to prove the cold-boot
// affordance at `packet-delivered`; this one uses `page.reload()` in
// the SAME context to prove the phone-player's most common restore
// path (they backgrounded the tab, came back, refreshed) lands on
// recognition, because the live runtime now persists the auto-advanced
// beat (see aftersign/main.js deliverPacket(): the 1180ms setTimeout
// calls `persistAuthoritative({ dirty: true })` AFTER `setBeat(
// "io-return-recognition")`, so reload stays on recognition rather
// than snapping back to the stale `packet-delivered` save).
//
// Runtime premises this spec depends on (validated against shipped code
// on 2026-10-15):
//   1. `deliverPacket()` writes the durable save TWICE: once at
//      `packet-delivered` (synchronous), once at
//      `io-return-recognition` inside the 1180ms setTimeout AFTER
//      `setBeat(...)`. The second write wins; reload restores to
//      `io-return-recognition`, NOT `packet-delivered`.
//   2. The RETURNING-tier line for outcome=sealed + routeListened=false
//      is Io's canonical copy in aftersign/src/ioRecognitionDialogue.ts:
//      "I remember you: blue seal, unbroken. The kiosk kept the route;
//      I kept your name beside it." — NOT "You came back…" (that line
//      lives in aftersign/src/ioReturningSession.ts and speaks at
//      `packet-delivered`, a different beat). Both pre- and post-reload
//      assertions here go through `expectedIoRecognitionLine(...)` so
//      the copy contract stays owned by a single module.
//   3. `skip-kiosk-acknowledge` (NOT `acknowledge-kiosk`) keeps
//      `routeListened=false` so the RETURNING tier speaks — tapping
//      `acknowledge-kiosk` would flip the story into the deep-recall
//      tier and this spec's assertions would falsify on both sides of
//      the reload.
//   4. Wait for beats via the rendered `[data-beat-id="…"]` node, not
//      `window.__game.scene.beat` — the DOM is the played surface, and
//      `data-beat-id` is the contract asserted by
//      apps/web/src/aftersign/servedSurface.contract.test.ts. The
//      served surface does NOT set `data-aftersign-beat` on <html>;
//      polling that attribute (as an earlier rewrite of this spec did)
//      times out. Two sibling specs document this exact mistake —
//      io-voice-served.spec.ts:88-89 and
//      m-continue-next-packet-loop-buttons-enabled.spec.ts:17.
//   5. Timeouts match the sibling visual-feel spec (60s per beat,
//      180s test ceiling) because the reload path re-runs the WebGL
//      cold-start under SwiftShader on CI.
//   6. `hasTouch: true` is required on the phone context. Without it
//      `#packetButton.tap()` throws
//      `locator.tap: The page does not support tap.` — see
//      io-voice-served.spec.ts:74-80 for the same requirement on every
//      phone-tap spec in this directory.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

// #2397 re-review: `skip-kiosk-acknowledge` sets
// `state.player.secondAction = SECOND_ACTION.SKIPPED`, and the main.js
// SKIPPED-ROUTE SUFFIX at `syncIoLine` ~L1783 APPENDS the authored
// `skippedReturn` line to the sealed RETURNING line — `#line` names
// BOTH dimensions (packet outcome + skip). The opened-branch sibling
// spec (`aftersign-recognition-reload-restoration.playtest.spec.ts`)
// asserts the opened prefix + the same suffix, so a bug that spoke the
// sealed line on the opened branch (or vice versa) reds the
// corresponding spec.
const SEALED_RECOGNITION_LINE = `${expectedIoRecognitionLine("sealed", false)} ${getAftersignIoRouteReturnLine(false).text}`;

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

test.describe("AFTERSIGN recognition reload playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("keeps Io's recognition beat and rendered tone controls after a phone-player reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `recognition-reload-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    // --- Play from a fresh save to io-return-recognition via taps only.
    await waitForBeat(page, "packet-offered");
    const packet = page.locator("#packetButton");
    await expect(packet, "#packetButton should be visible at packet-offered").toBeVisible({
      timeout: WAIT_MS,
    });
    await packet.tap();

    await waitForBeat(page, "packet-choice");
    // skip-kiosk-acknowledge keeps routeListened=false so the RETURNING
    // tier of ioRecognitionDialogue speaks at io-return-recognition.
    await tapChoice(page, "skip-kiosk-acknowledge");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // The runtime auto-advances into the recognition beat after
    // deliverPacket()'s ~1180ms setTimeout — the SECOND auto-save fires
    // AFTER `setBeat("io-return-recognition")` so reload will restore
    // to this beat, not `packet-delivered`.
    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.getByRole("button", { name: "Kind return", exact: true }),
    ).toBeVisible({ timeout: WAIT_MS });

    // --- Reload. Both auto-saves have fired; the LATER one
    // (post-`setBeat("io-return-recognition")`) is the one that
    // persists. The phone-player path must restore directly to
    // `io-return-recognition` with the sealed-outcome line + the
    // "Kind return" tone control intact — no "Return to Io" tap.
    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.getByRole("button", { name: "Kind return", exact: true }),
    ).toBeVisible({ timeout: WAIT_MS });
  });
});
