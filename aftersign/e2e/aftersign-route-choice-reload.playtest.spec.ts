import { expect, test, type Page, type Locator } from "@playwright/test";

// Playtest: #2326 (live-verify of #2322). On the Aftersign route-return
// choice screen (beat = `packet-choice`), reloading the page used to
// restore the LATER `packet-delivered` beat's "I listened / I ran early
// / Return to Io" fork — even though the player never delivered. The
// restore guard in `reloadFromSave` (aftersign/main.js:4040-4057) now
// remaps a persisted beat of `packet-delivered` to `packet-choice` when
// `packet.delivered` is false, which is only true for a save written
// while the player is still choosing a route.
//
// This spec proves the fix end-to-end against the served bundle the
// phone player actually loads:
//   1. Reach `packet-choice` by tapping `#packetButton` → the offered job.
//   2. Reload WITHOUT tapping either route-choice fork or `deliver-packet`.
//   3. Assert the restored beat is `packet-choice` (not `packet-delivered`).
//   4. Assert the `#routeChoice` affordance ("I listened" / "I ran early")
//      is NOT visible — that fork belongs to post-delivery, not here.
//   5. Assert the route-choice affordance (the offered route buttons) is
//      visible, so the player can resume where they left off.
//
// Runtime premises validated against shipped code at session commit
// c7e78bb (2026-10-15):
//   - `data-beat-id` on the rendered line is the DOM contract asserted by
//     apps/web/src/aftersign/servedSurface.contract.test.ts. Siblings in
//     this directory (aftersign-recognition-reload.playtest.spec.ts:36-42)
//     document that polling `window.__game.scene.beat` or
//     `data-aftersign-beat` on <html> times out — do NOT.
//   - `hasTouch: true` is required for `.tap()` on the phone context (see
//     the same sibling spec at line 42).
//   - Autosave fires on each tap; by the time we have tapped
//     `#packetButton` and reached `packet-choice`, a save exists carrying
//     either (a) beat=`packet-choice` or (b) the legacy contradictory
//     pair beat=`packet-delivered` + packet.delivered=false. Either way,
//     the fixed `reloadFromSave` restores to `packet-choice` and the
//     assertions below hold.
//   - The route-return "I ran early" fork is rendered by
//     `#skipRouteButton` ("I ran early") inside `#routeChoice`; see
//     aftersign/index.html:1186. Its visibility is the bug's symptom.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(
    beatNode,
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
  return beatNode;
}

test.describe("AFTERSIGN route-choice reload playtest", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test(
    "a save made at packet-choice restores to packet-choice, not packet-delivered",
    async ({ page }) => {
      test.setTimeout(COLD_START_MS);

      const slot = `route-choice-reload-${Date.now()}`;
      await page.goto(`/aftersign/index.html?slot=${slot}`, {
        waitUntil: "load",
      });

      // --- Play from a fresh save up to the route-choice fork, by taps only.
      await waitForBeat(page, "packet-offered");
      const packet = page.locator("#packetButton");
      await expect(
        packet,
        "#packetButton should be visible at packet-offered",
      ).toBeVisible({ timeout: WAIT_MS });
      await packet.tap();

      // Landing on packet-choice is the surface the player is stranded on
      // in #2326's repro. Reload immediately — do NOT tap deliver-packet,
      // do NOT tap skip-kiosk-acknowledge or acknowledge-kiosk. The bug
      // only shows up when the save was written at this beat, before any
      // route-return fork existed in the story.
      await waitForBeat(page, "packet-choice");

      // --- Reload. If the restore guard regresses, the next assertion
      // falsifies because the beat flips to `packet-delivered`.
      await page.reload({ waitUntil: "load" });

      await waitForBeat(page, "packet-choice");

      // The route-return "I listened / I ran early" fork must NOT render
      // here — that fork belongs to the post-delivery recognition beat,
      // and projecting it onto a save that never delivered is #2326's
      // reported symptom. `#skipRouteButton` is the "I ran early" tap
      // (aftersign/index.html:1186); its hidden state is the fix.
      await expect(
        page.locator("#skipRouteButton"),
        'the "I ran early" fork should NOT be visible at packet-choice',
      ).toBeHidden({ timeout: WAIT_MS });

      // The player's actual affordance at packet-choice — a visible
      // `deliver-packet` route-choice button — must be present so they
      // can resume where they left off.
      const deliver = page
        .locator('button[data-choice-id="deliver-packet"]:not([disabled])')
        .first();
      await expect(
        deliver,
        "the route-choice deliver affordance should be visible after reload",
      ).toBeVisible({ timeout: WAIT_MS });
    },
  );
});
