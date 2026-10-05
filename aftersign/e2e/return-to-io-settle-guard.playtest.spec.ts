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
// Soren's PR #2176 REQUEST_CHANGES feedback:
//   AI007 — the title was a fix but the diff was spec-only; the
//           `main.js` stamp was missing. This revision pairs the
//           spec with the stamp in `inputAdapters.js`.
//   AI003 — the prior spec asserted `not.toContainText(BLUNT_REPLY)`
//           once, immediately after the recognition beat became
//           visible. A ghost click can land AFTER that single
//           sample; the spec also never checked the evasive recall
//           at the next offer. This revision (a) polls `#line`
//           across the full settle window after the Return-to-Io
//           tap and asserts the blunt reply stays absent for the
//           whole window, and (b) traverses one full M-LOOP round
//           to the next `packet-offered` beat and asserts Io's
//           offer line carries the EVASIVE recall clause (`"dodged"`,
//           from `ioOfferMemoryLine.js`), NOT the blunt one
//           (`"told me straight"`). Without the stamp the ghost
//           click records a blunt reason and that recall clause
//           flips — the spec FAILS on `main`.
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

    // The tap must land us on the recognition beat with the tone
    // buttons visible — observable through `[data-beat-id]` and the
    // `[data-return-reason]` locators the renderer stamps.
    await waitForBeat(page, "io-return-recognition");
    await expect(
      page.locator('button[data-return-reason="blunt"]'),
      "blunt tone button should render on io-return-recognition",
    ).toBeVisible({ timeout: WAIT_MS });

    // #2174 acceptance (1): NO tone reply is shown until a tone
    // button is tapped. We POLL across the full ghost-click settle
    // window so a late-landing ghost click (iOS pointerup/click
    // dup, trailing pointer event on the re-rendered shared node)
    // cannot sneak the blunt reply past a single-sample check.
    // The prior spec sampled once — Soren PR #2176 AI003 flagged
    // that as insufficient; this is the fix.
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
