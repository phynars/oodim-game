import { expect, test } from "@playwright/test";

import {
  selectIoSecondPacketCopyForReturnReason,
} from "../src/ioSecondPacketCopy.ts";
import {
  ioSecondPacketResponseLine,
} from "../src/ioSecondPacketResponseVoice.ts";

// Phone 390×844 regression spec for issue #2193. This PR fixes
// exactly ONE of the three symptoms from blind playtest #4 — the
// dialogue double-render. The two remaining symptoms (offer labels
// splitting mid-word, right-edge dark strip after Deliver) are
// deferred to follow-up issues because the first-pass attempts at
// a fix in #2196 were drive-by no-ops (Soren's AI003 — `word-break:
// keep-all` only affects CJK text, so it does not stop Latin
// "delive/ry" from breaking; the real cause is the 4–5 column
// squeeze in #offeredJobs and this PR does not touch that layout).
// This spec therefore only guards symptom 1.
//
// Symptom 1 (fixed by this PR): `#line` and `#ioSecondPacketPointer`
// both carried the SAME response sentence
// (`ioSecondPacketResponseLine`), so a kind/evasive player saw
// "Good. Take the red tag…" rendered twice in a row. The fix stops
// stamping the pointer paragraph (its copy was identical to
// `#line`'s response, so the sibling `<p>` was pure duplication).
// The exact response literal is read from the copy module so a
// rename reds this spec at import time, not on the surface, and
// the `#line` assertion catches the double-dialogue regression
// precisely rather than via a non-empty guard.

const PHONE_VIEWPORT = { width: 390, height: 844 };

test.describe("AFTERSIGN phone 390×844 regression (#2193)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("renders Io's second-packet response exactly once", async ({ page }) => {
    await page.goto("/aftersign/?slot=phone-390-layout-regression", {
      waitUntil: "load",
    });

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

    // The response sentence must appear ONCE. The exact literal
    // comes from the copy module, so a rename reds at import.
    const expectedResponse = selectIoSecondPacketCopyForReturnReason({
      returnReason: "kind",
    }).choices.find((choice) => choice.id === "accept-second-packet")!.response;
    // The pointer line and the choice response are the SAME
    // sentence (both authored by `ioSecondPacketResponseLine`) —
    // proving the duplication the fix removes.
    expect(ioSecondPacketResponseLine("accept-second-packet")).toBe(expectedResponse);

    await expect(page.locator("#line")).toHaveText(expectedResponse);
    // No sibling pointer paragraph — the beat's primary `#line`
    // owns this copy.
    await expect(page.locator("#ioSecondPacketPointer")).toHaveCount(0);
    // Belt-and-suspenders: no element OTHER than #line may carry
    // the exact response sentence. If anything else does, the
    // player sees the line twice. This is the assertion that
    // reds on main (where the pointer paragraph still stamps the
    // same sentence → two text nodes carry it).
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

  // Symptom 2 (offer labels wrap mid-word) and symptom 3 (right-
  // edge dark strip after Deliver) are tracked separately. The
  // #2196 first pass tried a drive-by CSS tweak for symptom 2
  // (`word-break: keep-all` + `overflow-wrap: normal`) but Soren
  // correctly flagged it as a no-op: `keep-all` only affects CJK
  // text and `overflow-wrap: normal` is the default — nothing in
  // that pair prevents Latin mid-word breaking. The real cause is
  // the 4–5 narrow column squeeze on `#offeredJobs` layout, which
  // this PR does not touch. Do NOT re-add a speculative test here
  // without a confirmed source fix in the same PR.
});
