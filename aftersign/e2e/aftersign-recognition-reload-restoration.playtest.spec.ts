import { expect, test, type Page, type Locator } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";

// Playtest: after a phone-player reload, the OPENED-packet recognition
// beat restores via the shipped durable-save contract — auto-save fires
// on the `deliver-packet` tap at `packet-delivered`, so reload restores
// to `packet-delivered` and a single tap on the visible `#deliverButton`
// ("Return to Io") reaches `io-return-recognition` with the canonical
// RETURNING-tier line for outcome=opened + routeListened=false.
//
// Coverage complement to aftersign/e2e/aftersign-recognition-reload.playtest.spec.ts:
//   sibling  → outcome=sealed  (RETURNING_LINES.sealed)
//   this one → outcome=opened  (RETURNING_LINES.opened)
// The two lines diverge in aftersign/src/ioRecognitionDialogue.ts:41-45;
// a regression on the opened branch (wrong copy after reload, missing
// tone controls) would slip past the sealed spec.
//
// Runtime premises validated against shipped code on 2026-09-29:
//   1. `open-packet` at `packet-choice` records the opened outcome —
//      the choice IDs list is enumerated at
//      aftersign/e2e/save-load-durable-contract.spec.ts:48
//      ("open-packet" | "keep-packet-sealed" | "deliver-packet").
//   2. Auto-save fires on `deliver-packet`; restored beat is
//      `packet-delivered`, NOT `io-return-recognition` — see the
//      sealed sibling's premise notes and
//      aftersign/e2e/packet-delivered-cold-boot-affordance.spec.ts.
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

// Advance from restored `packet-delivered` into `io-return-recognition`
// by tapping the visible `#deliverButton` ("Return to Io"). This is the
// ONLY path from the persisted save back into recognition on a reloaded
// phone; there is no auto-advance from a durable save.
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

test.describe("AFTERSIGN recognition reload restoration (opened)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("restores the opened-packet Io recognition beat after a phone-player reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `recognition-reload-restoration-opened-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    // --- Play from a fresh save to io-return-recognition via taps only.
    await waitForBeat(page, "packet-offered");
    const packet = page.locator("#packetButton");
    await expect(
      packet,
      "#packetButton should be visible at packet-offered",
    ).toBeVisible({ timeout: WAIT_MS });
    await packet.click();

    await waitForBeat(page, "packet-choice");
    // open-packet → outcome=opened; skip-kiosk-acknowledge keeps
    // routeListened=false so the RETURNING tier speaks.
    await tapChoice(page, "open-packet");
    await tapChoice(page, "skip-kiosk-acknowledge");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    // Runtime auto-advances into recognition after deliverPacket()'s
    // ~1180ms setTimeout — no extra tap needed BEFORE the reload.
    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(OPENED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.locator('button[data-return-reason]:not([disabled])'),
    ).toHaveCount(3, { timeout: WAIT_MS });

    // --- Reload. Auto-save fired on the `deliver-packet` tap, so the
    // restored beat is `packet-delivered`. The phone-player path must
    // render the "Return to Io" advance, then reach
    // `io-return-recognition` with the opened-outcome line + full tone
    // controls after ONE visible tap.
    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "packet-delivered");
    await tapReturnToIo(page);

    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#line")).toHaveText(OPENED_RECOGNITION_LINE, {
      timeout: WAIT_MS,
    });
    await expect(
      page.locator('button[data-return-reason]:not([disabled])'),
    ).toHaveCount(3, { timeout: WAIT_MS });
  });
});
