import { expect, test } from "@playwright/test";

import {
  selectIoSecondPacketCopyForReturnReason,
} from "../src/ioSecondPacketCopy.ts";
import {
  ioSecondPacketResponseLine,
} from "../src/ioSecondPacketResponseVoice.ts";

// Phone 390×844 regression spec for issue #2193. Pins the three
// symptoms from blind playtest #4:
//   1. Dialogue double-rendered — `#line` and `#ioSecondPacketPointer`
//      both carried the SAME response sentence, so a kind/evasive
//      player saw "Good. Take the red tag…" twice in a row. The fix
//      stops stamping the pointer paragraph (its copy is identical to
//      `#line`'s response, so the sibling `<p>` was pure duplication).
//   2. Offer labels wrapping mid-word in the narrow jobs tray
//      ("Mark/ed", "delive/ry") — fixed by `white-space: nowrap` plus
//      ellipsis on the offer buttons.
//   3. A dark right-edge strip after Deliver clipping pills — a visible
//      control must fit inside 390 CSS px AND the hit-test at its
//      right edge must resolve to the control itself (not a cover).
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
    // `white-space: nowrap` and must NOT be horizontally clipped past
    // its own clientWidth (nowrap + ellipsis keeps each route-name
    // word intact in the narrow phone tray).
    const offers = page.locator("#offeredJobs button");
    await expect(offers.first()).toBeVisible();
    const offerCount = await offers.count();
    for (let index = 0; index < offerCount; index += 1) {
      const offer = offers.nth(index);
      await expect(offer).toHaveCSS("white-space", "nowrap");
      const { scrollWidth, clientWidth } = await offer.evaluate((node) => ({
        scrollWidth: (node as HTMLElement).scrollWidth,
        clientWidth: (node as HTMLElement).clientWidth,
      }));
      expect(scrollWidth, `offer ${index} fits its box without horizontal overflow`)
        .toBeLessThanOrEqual(clientWidth);
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

  test("keeps controls inside and uncovered after Deliver", async ({ page }) => {
    await page.goto("/aftersign/?slot=phone-390-controls", { waitUntil: "load" });
    await page.locator("#deliverButton").click();
    await expect(page.locator("#acknowledgeRouteButton")).toBeVisible();

    // Symptom 3 — every visible button after Deliver must fit inside
    // the 390×844 viewport AND the hit-test at its right edge must
    // resolve to that button, meaning nothing covers it.
    const controls = page.locator("button:visible");
    const count = await controls.count();
    expect(count, "at least one visible control after Deliver").toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      const id = (await control.getAttribute("id")) ?? `[unlabelled-${index}]`;
      const box = await control.boundingBox();
      expect(box, `visible control ${id} has a box`).not.toBeNull();
      expect(box!.x, `${id} left edge inside viewport`).toBeGreaterThanOrEqual(0);
      expect(box!.y, `${id} top edge inside viewport`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `${id} right edge inside 390 CSS px viewport`,
      ).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
      expect(
        box!.y + box!.height,
        `${id} bottom edge inside 844 CSS px viewport`,
      ).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
      // Hit-test 1 CSS px inside the right edge, at vertical center.
      // If a dark strip covers the right side, elementFromPoint
      // resolves to the cover, not to this button.
      const hitId = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.id ?? null,
        {
          x: box!.x + box!.width - 1,
          y: box!.y + box!.height / 2,
        },
      );
      expect(hitId, `${id} right edge is not covered by another element`).toBe(id);
    }
  });
});
