import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN red-tag retention through `packet-choice` and the following
// `io-return-recognition` beat (#2201 live-verify follow-up to #2192).
//
// Route the player actually walks on game.oodim.com — same shape as the
// sibling spec `red-tag-second-packet-served.spec.ts`, which proves the
// red-tag label LANDS at `packet-offered` round-two. This spec starts
// where that one leaves off and proves the label SURVIVES the packet
// tap into `packet-choice` and that Io's following return line still
// speaks the red-tag thread (the two FAIL steps in #2201).
//
//   `packet-offered` (fresh boot, armed blue) →
//     tap `#deliverButton` (sealed-default) →
//   `io-return-recognition` →
//     tap `#acknowledgeRouteButton` (kind) →
//   `return-tone-choice` →
//     tap `#deliverButton` ("Ask for next job") →
//   `io-next-job` →
//     tap `accept-second-packet` (choice button, stamped on
//     `#acknowledgeRouteButton` at this beat; see sibling
//     `red-tag-second-packet-served.spec.ts`) →
//     tap `#deliverButton` ("Deliver next packet") →
//   `packet-offered` (round two, red-tag armed by
//     `choose("deliver-packet")` in main.js — the handler that reads
//     `state.player.secondPacketHandoffAccepted` and sets
//     `state.delivery.id = "red-tag"` plus `#packetButton.textContent =
//     "Red tag — Saint Orra"` (PR #2199)) →
//     ASSERT `#packetButton` reads "Red tag — Saint Orra" →
//     tap `#packetButton` →
//   `packet-choice` →
//     ASSERT `#packetButton` STILL reads "Red tag — Saint Orra"
//     (the #2201 FAIL at step 4: the generic blue packet-outcome copy
//     writer used to erase the red-tag label here). →
//     tap `#deliverButton` (sealed-default commit) →
//   `packet-delivered` → auto-advance to `io-return-recognition` →
//     ASSERT `#line` contains the red-tag recognition thread (the
//     #2201 FAIL at step 6: Io used to replay the generic
//     "blue seal, unbroken" line).

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: {
      version?: number;
      scene?: { ready?: boolean };
      getSnapshot?: () => { scene: { beat: string } };
    };
  }
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__game?.getSnapshot?.().scene.beat),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

async function tap(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector);
  await expect(target).toBeVisible({ timeout: WAIT_MS });
  await expect(target).toBeEnabled();
  await target.tap();
}

test.describe("AFTERSIGN red-tag packet retention (#2201)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a played second packet retains Saint Orra through packet-choice and the next return", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(
      `/aftersign/?slot=red-tag-retention-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Round one — deliver sealed, choose the kind return tone, ask for
    // the next job. Same walk as the sibling
    // `red-tag-second-packet-served.spec.ts` (PR #2199).
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-return-recognition");
    await tap(page, "#acknowledgeRouteButton");
    await waitForBeat(page, "return-tone-choice");
    await tap(page, "#deliverButton");
    await waitForBeat(page, "io-next-job");

    // At `io-next-job` the two choice buttons stamp
    // `data-choice-id="accept-second-packet"` (on `#acknowledgeRouteButton`)
    // and `decline-second-packet` (on `#skipRouteButton`). Tap the
    // accept, THEN tap `#deliverButton` ("Deliver next packet") to
    // commit — the SAME two-tap handoff the sibling red-tag spec drives.
    const secondPacket = page.locator(
      'button[data-choice-id="accept-second-packet"]',
    );
    await expect(secondPacket).toHaveText("Take the second packet");
    await secondPacket.tap();
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-offered");

    // Round-two offer carries the red-tag identity set by
    // `choose("deliver-packet")` in main.js (PR #2199 — the handler
    // writes `state.delivery = { id: "red-tag", outcome: "unknown" }`
    // and stamps `#packetButton.textContent = "Red tag — Saint Orra"`).
    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    // #2201 step 4 FAIL re-check: tapping `#packetButton` moves to
    // `packet-choice` and the generic blue packet-outcome copy writer
    // used to overwrite the red-tag label with
    // "Blue packet — Seal intact…". The fix in `commitPacketOutcome`
    // overrides `applyButtonCopy` when `state.delivery.id === "red-tag"`
    // so the label survives.
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");
    await expect(packetButton).toHaveText("Red tag — Saint Orra");

    // Commit the sealed-default fork — same `#deliverButton` tap the
    // sibling red-tag spec uses to reach `packet-delivered`.
    await tap(page, "#deliverButton");
    await waitForBeat(page, "packet-delivered");

    // #2201 step 6 FAIL re-check: Io used to speak the generic
    // "blue seal, unbroken" line at the following
    // `io-return-recognition`. The fix in `lineForBeat()` short-
    // circuits that branch when `state.delivery.id === "red-tag"`.
    // Io's recognition thread is rendered into `#line` — the only
    // line node in `aftersign/index.html`. Earlier drafts of this
    // spec targeted `#ioText`, which does not exist in the DOM or
    // in `main.js` (reviewer AI008 on PR #2205 iter-1).
    await waitForBeat(page, "io-return-recognition");
    const lineEl = page.locator("#line");
    await expect(lineEl).toContainText(/red tag/i);
    await expect(lineEl).toContainText(/saint orra/i);
    await expect(lineEl).not.toContainText(/blue seal/i);
  });
});
