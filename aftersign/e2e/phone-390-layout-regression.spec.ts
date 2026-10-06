import { expect, test } from "@playwright/test";

import {
  selectIoSecondPacketCopyForReturnReason,
} from "../src/ioSecondPacketCopy.ts";
import {
  ioSecondPacketResponseLine,
} from "../src/ioSecondPacketResponseVoice.ts";

// Phone 390×844 regression spec for issue #2193. Pins two of the
// three symptoms from blind playtest #4 (the third — "right-edge
// strip after Deliver" — has no reproducible source fix in this PR
// and is tracked separately; see the inline comment at the end):
//
//   1. Dialogue double-rendered — `#line` and `#ioSecondPacketPointer`
//      both carried the SAME response sentence, so a kind/evasive
//      player saw "Good. Take the red tag…" twice in a row. The fix
//      stops stamping the pointer paragraph (its copy is identical to
//      `#line`'s response, so the sibling `<p>` was pure duplication).
//   2. Offer labels wrapping mid-word in the narrow jobs tray
//      ("Mark/ed", "delive/ry") — fixed by `word-break: keep-all`
//      plus `overflow-wrap: normal` on the offer buttons. Note we
//      deliberately keep `white-space: normal` (not `nowrap`) so the
//      button's bounding-box dimensions stay in the pre-fix layout
//      flow and the sibling press-juice spec
//      (`aftersign-job-offer-press-juice.playtest.spec.ts`) that
//      measures the same button's transformed rect reads the
//      authored scale(0.97) envelope — not a layout-driven height
//      collapse masquerading as a scale drop (PR #2196 first pass
//      regressed that spec with `nowrap + overflow:hidden + ellipsis`).
//
// The exact response literal is read from `ioSecondPacketCopy.ts` /
// `ioSecondPacketResponseVoice.ts` so a copy rename reds this spec at
// import time, not on the surface, and the `#line` assertion catches
// the double-dialogue regression precisely rather than via a
// non-empty guard.

const PHONE_VIEWPORT = { width: 390, height: 844 };

test.describe("AFTERSIGN phone 390×844 regression (#2193)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("keeps offer words whole and response dialogue singular", async ({ page }) => {
    await page.goto("/aftersign/?slot=phone-390-layout-regression", {
      waitUntil: "load",
    });

    // Symptom 2 — offer labels: every offered-jobs button must declare
    // `word-break: keep-all` + `overflow-wrap: normal` so a mid-word
    // split like "delive/ry" cannot land in the rendered label. These
    // two CSS properties ARE the fix for the reported symptom; asserting
    // their presence on every offer button is the primary guard.
    //
    // Why we DON'T also assert `scrollWidth <= clientWidth` here (Soren
    // on PR #2196): `keep-all` legitimately permits a single long word
    // to overflow its box rather than break mid-word. Current offer
    // copy ("Safe delivery · low risk") is short and would pass the
    // strict overflow check, but a future label rename to a longer
    // token would red THIS spec on an overflow that is the authored
    // behavior of the fix — not a regression. The real symptom is
    // "words split mid-letter", not "any horizontal overflow", and
    // the two CSS asserts above are the correct source-level guard.
    const offers = page.locator("#offeredJobs button");
    await expect(offers.first()).toBeVisible();
    const offerCount = await offers.count();
    for (let index = 0; index < offerCount; index += 1) {
      const offer = offers.nth(index);
      await expect(offer).toHaveCSS("word-break", "keep-all");
      await expect(offer).toHaveCSS("overflow-wrap", "normal");
    }

    // Walk real taps through: deliver first packet → kind return
    // (acknowledgeRouteButton) → ask for next job → io-next-job →
    // tap `accept-second-packet` → response lands on #line.
    await page.locator("#deliverButton").click();
    await page.locator("#acknowledgeRouteButton").click();
    await expect(page.locator("#deliverButton")).toHaveText("Ask for next job");
    await page.locator("#deliverButton").click();

    const acceptChoice = page
      .locator('button[data-choice-id="accept-second-packet"]:not([disabled])')
      .first();
    await expect(acceptChoice).toBeVisible();
    await acceptChoice.click();

    // Symptom 1 — the response sentence must appear ONCE. The exact
    // literal comes from the copy module, so a rename reds at import.
    const expectedResponse = selectIoSecondPacketCopyForReturnReason({
      returnReason: "kind",
    }).choices.find((choice) => choice.id === "accept-second-packet")!.response;
    // The pointer line and the choice response are the SAME sentence
    // (both authored by `ioSecondPacketResponseLine`) — proving the
    // duplication the fix removes.
    expect(ioSecondPacketResponseLine("accept-second-packet")).toBe(expectedResponse);

    await expect(page.locator("#line")).toHaveText(expectedResponse);
    // No sibling pointer paragraph — the beat's primary `#line` owns
    // this copy.
    await expect(page.locator("#ioSecondPacketPointer")).toHaveCount(0);
    // Belt-and-suspenders: no element OTHER than #line may carry the
    // exact response sentence. If anything else does, the player sees
    // the line twice.
    const occurrences = await page.evaluate((text) => {
      let hits = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if ((node.textContent ?? "").trim() === text) hits += 1;
        node = walker.nextNode();
      }
      return hits;
    }, expectedResponse);
    expect(occurrences, "response sentence appears in exactly one text node").toBe(1);
  });

  // Symptom 3 (right-edge dark strip after Deliver, clipping pills
  // past x≈332) is tracked separately. The PR #2196 first-pass
  // attempt at a reproducer ("keeps controls inside and uncovered
  // after Deliver") either passed on main already or failed for
  // layout reasons unrelated to the covered strip, so Soren's
  // "every new test must fail on main first" gate was not met. The
  // strip source has not been localized in a reviewed diff; a
  // follow-up issue owns the reproducer + fix. Do NOT re-add a
  // speculative test here without a confirmed source fix in the
  // same PR.
});
