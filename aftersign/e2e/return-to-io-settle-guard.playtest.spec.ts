import { expect, test, type Page } from "@playwright/test";
import { IO_RETURN_TONE_OPTIONS } from "../../apps/web/src/aftersign/story/ioContinueBeats.ts";

// AFTERSIGN return-to-Io settle guard — proves issue #2174 element-level
// through visible DOM only, no `window.__game` snapshot reads.
//
// Bug (#2174): on the `packet-delivered` beat, `#deliverButton` is
// labelled "Return to Io". On `io-return-recognition` the SAME DOM
// node becomes the Blunt return-tone button
// (`data-return-reason="blunt"`). The `choose-return-tone` settle
// gate in `aftersign/main.js` (RECOGNITION_SETTLE_MS) is supposed
// to drop the second interpretation of one gesture, but it only
// holds when `state.interaction.recognitionEnteredAt` is stamped.
// The `return-to-io` path left the stamp UNSET, so a ghost click
// (iOS pointerup/click dup, or the trailing pointer event on the
// re-rendered node) silently recorded a BLUNT return the player
// never chose. Io then opened round two with
// "And last time you told me straight." — the false-memory
// M-LOOP closeout cannot survive.
//
// Soren's PR #2176 REQUEST_CHANGES feedback — iterations:
//   AI007 (round 1) — the title was a fix but the diff was spec-only;
//           the `main.js` stamp was missing. This revision pairs the
//           spec with the stamp in `inputAdapters.js`.
//   AI003 (round 2) — the prior spec sampled `not.toContainText(BLUNT_REPLY)`
//           once right after the beat flipped. One `.tap()` is one
//           click, so on `main` a single-tap spec passes trivially
//           (no second gesture ever lands on the Blunt node). The
//           bug needs a REAL second physical click on the shared
//           `#deliverButton` node AFTER the beat flips to
//           `io-return-recognition`. That is what distinguishes
//           main (no stamp → gate passes → second click records
//           BLUNT → next offer recalls "told me straight") from the
//           fix (stamp written on first tap → gate drops the second
//           click within RECOGNITION_SETTLE_MS → return reason stays
//           unset → an EVASIVE tap later lands cleanly → next offer
//           recalls "dodged"). This revision performs that second
//           physical tap on `#deliverButton` and asserts both
//           acceptance signals.
//
// Acceptance (from the issue):
//   1. after tapping "Return to Io" by pointer, NO tone-reply line
//      is shown until a tone button is tapped, AND the return
//      reason is still unset (observed indirectly via Io's recall
//      at the next offer);
//   2. tapping "Evasive return" surfaces Io's evasive reply;
//   3. at the NEXT offer, Io recalls the evasive return
//      ("dodged"), not the blunt one ("told me straight").
//
// Observation discipline mirrors `aftersign-packet-recall-feel.playtest.spec.ts`:
//   - 390x844 hasTouch viewport, `.tap()` on visible elements
//     (NOT the shared `#deliverButton` node, NOT the shared
//     `#skipRouteButton` node, when a tone-specific button is
//     available).
//   - All assertions read the served `#line` paragraph. Expected
//     copy comes from the shipped `IO_RETURN_TONE_OPTIONS` module
//     and the shipped `ioOfferMemoryLine.js` literals, so a future
//     author re-write of the replies updates this spec in one
//     place and never drifts.
//   - No `page.waitForTimeout` as a sync primitive — the one
//     fixed-interval wait we DO use is a GHOST-CLICK settle
//     window, not a UI timing guess, and we poll `#line` across
//     it to prove the blunt reply stayed absent the whole time.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 90_000;

// Must match / exceed `RECOGNITION_SETTLE_MS` in `aftersign/main.js`.
// The settle gate is on the order of ~200ms today; 600ms is a
// generous ceiling that covers the gate PLUS the trailing-click
// race window on iOS WebKit (pointerup → synthetic click can lag
// by ~300ms on sluggish devices). If the gate is ever raised the
// spec stays correct — a wider ghost-click window only makes the
// polling MORE strict, never less.
const GHOST_CLICK_SETTLE_WINDOW_MS = 600;
const GHOST_CLICK_POLL_INTERVAL_MS = 50;

const BLUNT_REPLY = IO_RETURN_TONE_OPTIONS.find((o) => o.id === "blunt")!.reply;
const EVASIVE_REPLY = IO_RETURN_TONE_OPTIONS.find((o) => o.id === "evasive")!
  .reply;

// Io's offer-line recall clauses — single-sourced from
// `aftersign/src/ioOfferMemoryLine.js`. We import the LITERALS
// (not the function) because this spec drives the real page; the
// function's output is already in `#line` when `packet-offered`
// lands. If a writer re-authors the recall clauses this import
// should be updated — these are the two signatures a player sees.
const EVASIVE_RECALL_SIGNATURE = "dodged";
const BLUNT_RECALL_SIGNATURE = "told me straight";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should visibly reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(
    choice,
    `choice "${choiceId}" should be visible and tappable`,
  ).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

/**
 * Poll `#line` across the full ghost-click settle window and fail
 * if the blunt reply ever appears. Catches late-landing ghost
 * clicks the earlier single-sample `not.toContainText` missed
 * (Soren PR #2176 AI003).
 */
async function assertBluntReplyAbsentAcrossSettleWindow(
  page: Page,
): Promise<void> {
  const start = Date.now();
  const line = page.locator("#line");
  while (Date.now() - start < GHOST_CLICK_SETTLE_WINDOW_MS) {
    const text = (await line.textContent()) ?? "";
    expect(
      text,
      `blunt reply must never appear during the settle window ` +
        `(saw "${text}" after ${Date.now() - start}ms)`,
    ).not.toContain(BLUNT_REPLY);
    await page.waitForTimeout(GHOST_CLICK_POLL_INTERVAL_MS);
  }
}

test.describe("AFTERSIGN return-to-Io settle guard (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("tapping Return to Io does not record a tone — only an explicit evasive tap does, and Io recalls evasive at the next offer", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    // Fresh slot — forces the first-visit safe-default offer so the
    // route-risk tray is reachable without stepping on a stale save.
    await page.goto(`/aftersign/?slot=return-to-io-settle-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");

    // Take the safe-delivery offer so the deterministic route-risk
    // tray appears (same path the packet-recall sibling walks). The
    // settle-gate bug is on the return-to-Io path AFTER delivery, so
    // the route taken here doesn't matter beyond reaching it.
    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    const tray = page.locator("#routeRiskChoice");
    await expect(tray).toHaveAttribute("data-visible", "true", {
      timeout: WAIT_MS,
    });
    const safeRouteButton = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(safeRouteButton).toBeVisible({ timeout: WAIT_MS });
    await safeRouteButton.tap();
    await expect(safeRouteButton).toBeHidden({ timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    // `#deliverButton` is the shared node that relabels across beats
    // — the exact element the bug conflates. Tap it as "Return to Io".
    const deliverButton = page.locator("#deliverButton");
    await expect(deliverButton).toHaveText("Return to Io", { timeout: WAIT_MS });
    await deliverButton.tap();

    // The tap must land us on the recognition beat and the SAME
    // `#deliverButton` DOM node must now carry the Blunt return
    // dataset — this is the exact element relabel that the bug
    // exploits. We wait on the dataset flip (not just visibility)
    // so the follow-up second tap below is deterministic.
    await waitForBeat(page, "io-return-recognition");
    await expect(
      deliverButton,
      "shared #deliverButton must relabel to the Blunt tone on io-return-recognition",
    ).toHaveAttribute("data-return-reason", "blunt", { timeout: WAIT_MS });

    // #2174 PROOF OF FAILURE ON MAIN — the second physical tap.
    //
    // The bug is NOT a passive ghost click Playwright can observe
    // on its own; it is a SECOND gesture on the re-rendered shared
    // node that `main.js`'s settle gate is supposed to drop. On
    // `main` the `return-to-io` handler never stamps
    // `recognitionEnteredAt`, so the gate `now - entered >=
    // RECOGNITION_SETTLE_MS` is trivially true and the second tap
    // commits BLUNT. On the fixed branch the stamp lives inside
    // `stampRecognitionEntryIfReturningToIo` (inputAdapters.js) and
    // the gate drops this second tap.
    //
    // We perform the second tap FORCEFULLY on `#deliverButton` so
    // the test does not care whether the renderer disabled the
    // button mid-settle on the fix branch — Playwright's `force`
    // bypasses the actionability check and dispatches the event
    // regardless, which is exactly what the iOS pointerup/click
    // duplicate does in the wild. On `main` this lands as a BLUNT
    // tone commit; on the fix it is dropped by the settle gate.
    await deliverButton.tap({ force: true });

    // Immediate observable: on `main` the blunt reply surfaces in
    // `#line` once the gate passes the second tap through. We
    // poll across the full settle window so a slow render on
    // underpowered CI hardware cannot false-pass by sampling too
    // early. On the fix branch the gate holds and this stays
    // absent for the whole window.
    await assertBluntReplyAbsentAcrossSettleWindow(page);

    // Now explicitly choose the EVASIVE tone through its dedicated
    // button — a DIFFERENT DOM node than `#deliverButton`, same
    // vocabulary as `aftersign-packet-recall-feel.playtest.spec.ts`.
    const evasiveButton = page
      .locator('button[data-return-reason="evasive"]:not([disabled])')
      .first();
    await expect(evasiveButton).toBeVisible({ timeout: WAIT_MS });
    await evasiveButton.tap();

    // Only now does the evasive reply surface in `#line`.
    const line = page.locator("#line");
    await expect(
      line,
      "evasive reply should render after the evasive tone is tapped",
    ).toContainText(EVASIVE_REPLY, { timeout: WAIT_MS });

    // And the blunt reply must NEVER have been spoken on this path —
    // the false-memory the bug produced.
    await expect(
      line,
      "blunt reply must never render when the player chose evasive",
    ).not.toContainText(BLUNT_REPLY);

    // #2174 acceptance (3): Io's NEXT offer must recall the evasive
    // return ("dodged my question"), NOT the blunt one ("told me
    // straight"). This is the player-visible proof that the stamp
    // held: if the ghost click had slipped past the gate on the
    // Return-to-Io tap, `state.player.returnReason` would be
    // `"blunt"` and this offer line would carry the blunt clause.
    // Traverse the loop the way `aftersign-mloop-two-round.playtest.spec.ts`
    // does: tone reply → ask for next job → deliver → next offer.
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "packet-offered");

    // The offer-line sits in `#line` once `packet-offered` lands on
    // round 2. Poll it so a slow render doesn't false-fail.
    await expect(
      line,
      "Io's round-2 offer must recall the evasive return (dodged), not blunt",
    ).toContainText(EVASIVE_RECALL_SIGNATURE, { timeout: WAIT_MS });
    await expect(
      line,
      "Io must not recall a blunt return the player never chose",
    ).not.toContainText(BLUNT_RECALL_SIGNATURE);
  });
});
