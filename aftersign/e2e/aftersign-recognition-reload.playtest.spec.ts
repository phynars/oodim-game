import { expect, test, type Page, type Locator } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";

// Playtest: after a phone-player reload, the story restores to
// `packet-delivered`, and a single visible tap on the rendered advance
// control (`#deliverButton`, labelled "Return to Io") reaches
// `io-return-recognition` with the correct returning-tier line + the
// authored return-tone controls.
//
// This spec is the "reload" companion to
// aftersign/e2e/packet-delivered-cold-boot-affordance.spec.ts — that one
// uses a fresh browser context (cleared storage) to prove the cold-boot
// affordance; this one uses `page.reload()` in the SAME context to prove
// the phone-player's most common restore path (they backgrounded the
// tab, came back, refreshed) lands on the same visible affordance.
//
// Runtime premises this spec depends on (validated against shipped code
// on 2026-09-29):
//   1. `deliver-packet` triggers an auto-save at `packet-delivered`.
//      Reload therefore restores to `packet-delivered`, NOT
//      `io-return-recognition`. See
//      packet-delivered-cold-boot-affordance.spec.ts:156 — the same
//      restore path requires a subsequent tap on `#deliverButton`
//      ("Return to Io") to reach the recognition beat.
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
//      apps/web/src/aftersign/servedSurface.contract.test.ts.
//   5. Timeouts match the sibling visual-feel spec (60s per beat,
//      90s test ceiling) because the reload path re-runs the WebGL
//      cold-start under SwiftShader on CI.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

const SEALED_RECOGNITION_LINE = expectedIoRecognitionLine("sealed", false);

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

// Advance from `packet-delivered` into `io-return-recognition` by
// tapping the visible `#deliverButton` ("Return to Io") — the same
// affordance the cold-boot spec pins at line 156. This is the ONLY
// path from the restored `packet-delivered` beat back into recognition
// on a reloaded phone; there is no auto-advance from a persisted save.
async function tapReturnToIo(page: Page): Promise<void> {
  const advance = page.locator("#deliverButton");
  await expect(
    advance,
    `#deliverButton should be visible at packet-delivered`,
  ).toBeVisible({ timeout: WAIT_MS });
  await expect(advance).toBeEnabled({ timeout: WAIT_MS });
  await expect(advance).toHaveText("Return to Io", { timeout: WAIT_MS });
  await advance.tap();
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
    await packet.click();

    await waitForBeat(page, "packet-choice");
    // skip-kiosk-acknowledge keeps routeListened=false so the RETURNING
    // tier of ioRecognitionDialogue speaks at io-return-recognition.
    await tapChoice(page, "skip-kiosk-acknowledge");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // The runtime auto-advances into the recognition beat after
    // deliverPacket()'s ~1180ms setTimeout — no additional tap needed
    // BEFORE the reload.
    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.getByRole("button", { name: "Kind return", exact: true }),
    ).toBeVisible({ timeout: WAIT_MS });

    // --- Reload. Auto-save fired on the `deliver-packet` tap, so the
    // restored beat is `packet-delivered`, NOT `io-return-recognition`.
    // The phone-player path must (a) restore the returning-session copy
    // on `#line`, (b) render the "Return to Io" advance control, and
    // (c) reach `io-return-recognition` with the correct line + tone
    // controls after ONE visible tap on that control.
    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "packet-delivered");
    await tapReturnToIo(page);

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(SEALED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.getByRole("button", { name: "Kind return", exact: true }),
    ).toBeVisible({ timeout: WAIT_MS });
  });
});
