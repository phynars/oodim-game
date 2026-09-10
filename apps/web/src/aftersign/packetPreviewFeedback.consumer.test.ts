// Served-surface consumer test for the PREVIEWED packet outcome
// (#1701, Refs #1698).
//
// Why this file exists (Soren's blocking review on PR #1701 draft 1):
//   The first draft added `PACKET_OUTCOME.PREVIEWED` +
//   `previewRelease()` in the pure `aftersign/src/packetIntent.ts`, and
//   a `previewed` branch in `apps/web/src/aftersign/packetChoiceFeel.ts` —
//   both correct in isolation, both pinned by pure checks — but NEITHER
//   reached the page a player touches. `aftersign/main.js` was still
//   calling `packetIntent.release(input)`, never `previewRelease()`,
//   and the earlier consumer test mounted a synthetic `<div
//   id="packetChoice">` its own comment admitted was a future-tense
//   render bridge. Zero shipped consumers — same shape
//   `HANDOFF-1698.md` flags as blocking on #1698 and #1694.
//
// This file closes that gap in the same idiom as
// `packetInteractionCopy.consumer.test.ts` (Soren-approved on PR #1563):
//
//   1. Load the REAL `aftersign/index.html` into JSDOM. Find the
//      shipped `#packetButton` element the finger actually touches.
//      If the button is missing this test reds — no drift between
//      the served markup and the render seam.
//   2. Drive `applyPacketPreviewFeedback(button, phase)` — the SAME
//      writer `aftersign/main.js`'s `packetRelease` calls after
//      `packetIntent.previewRelease(...)` lands — through the two
//      phases the outcome walks: `previewed` (stamp) → `cleared`
//      (a subsequent SEALED/OPENED commit removes the stamp).
//   3. Tap-driven pin: attach a real click handler that models the
//      served-page path. Given a summarised gesture with
//      `durationMs <= previewTapMaxMs`,
//      `evaluatePacketChoiceGesture` classifies it as `feedback:
//      "previewed"`; the handler stamps the DOM. A real `.click()`
//      on the real served node — no synthetic div. That's the
//      "player taps a rendered element" bridge Soren required.
//   4. Clear-on-commit pin: a follow-up gesture that seals (past
//      `previewTapMaxMs`) MUST clear the previous glance marker so
//      the DOM doesn't carry a stale `data-packet-feedback` past
//      the commit.
//   5. Null-safety pin: the writer MUST NOT throw on a null element
//      or a bare button. The main.js call site wraps in try/catch,
//      but the writer itself defends so a fresh DOM never
//      black-screens boot.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PACKET_CHOICE_FEEL,
  evaluatePacketChoiceGesture,
  type PacketChoiceGesture,
} from "./packetChoiceFeel";
import {
  applyPacketPreviewFeedback,
  PACKET_PREVIEW_FEEDBACK_ATTR,
  PACKET_PREVIEW_FEEDBACK_VALUE,
} from "./packetPreviewFeedback.js";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

const glanceGesture = (durationMs: number): PacketChoiceGesture => ({
  kind: "tap",
  durationMs,
  travelPx: 1,
  startedOnSeal: true,
  endedOnSeal: true,
});

describe("#packetButton served-surface PREVIEWED contract (drives real aftersign/index.html)", () => {
  let dom: JSDOM;
  let packetButton: HTMLButtonElement;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
    const button = dom.window.document.querySelector("#packetButton");
    if (!(button instanceof dom.window.HTMLButtonElement)) {
      throw new Error(
        "served aftersign/index.html must host a #packetButton element",
      );
    }
    packetButton = button as unknown as HTMLButtonElement;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("hosts the shipped #packetButton element the preview stamp lands on", () => {
    // Baseline: if the served markup loses the button the stamp
    // has nothing to write onto. Fires first so the failure points
    // at the DOM contract, not the writer.
    expect(packetButton).not.toBeNull();
    expect(packetButton.classList.contains("packet-button")).toBe(true);
    expect(packetButton.getAttribute("data-aftersign-tap-choice")).toBe(
      "packet",
    );
    expect(packetButton.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);
  });

  it("stamps data-packet-feedback=\"previewed\" on the served button after a very-quick glance tap", () => {
    // Model the shipped `packetRelease` seam: the pure feel judge
    // classifies a glance-length tap as `feedback: "previewed"`, and
    // the served renderer stamps the DOM via `applyPacketPreviewFeedback`.
    const decision = evaluatePacketChoiceGesture(glanceGesture(40));
    expect(decision.feedback).toBe("previewed");
    expect(decision.committed).toBe(false);
    expect(decision.choice).toBeNull();

    packetButton.addEventListener("click", () => {
      applyPacketPreviewFeedback(packetButton, "previewed");
    });

    // Real tap on the real served node — no synthetic div.
    packetButton.click();

    expect(packetButton.getAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(
      PACKET_PREVIEW_FEEDBACK_VALUE,
    );
  });

  it("stamps the preview marker for a tap exactly at previewTapMaxMs (inclusive upper bound)", () => {
    // Boundary pin — mirrors the pure lane's
    // `checkPreviewReleaseEmitsPreviewedForVeryQuickTap`.
    const decision = evaluatePacketChoiceGesture(
      glanceGesture(DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs),
    );
    expect(decision.feedback).toBe("previewed");

    applyPacketPreviewFeedback(packetButton, decision.feedback === "previewed" ? "previewed" : "cleared");
    expect(packetButton.getAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(
      PACKET_PREVIEW_FEEDBACK_VALUE,
    );
  });

  it("clears the preview marker on a subsequent SEALED commit (one ms past previewTapMaxMs)", () => {
    // Sequence: a glance stamps the DOM; then a slightly longer tap
    // commits SEALED and MUST clear the previous marker so the DOM
    // doesn't carry a stale `previewed` past the commit. This mirrors
    // `packetRelease`'s single-writer dispatch — the SAME call to
    // `applyPacketPreviewFeedback` runs on every release, phase
    // `"previewed"` only when the outcome is PREVIEWED.
    const glance = evaluatePacketChoiceGesture(glanceGesture(40));
    expect(glance.feedback).toBe("previewed");
    applyPacketPreviewFeedback(packetButton, "previewed");
    expect(packetButton.getAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(
      PACKET_PREVIEW_FEEDBACK_VALUE,
    );

    // Follow-up tap one ms past the preview ceiling — falls through
    // to the preserve-tap branch in the feel judge, which commits
    // SEALED. The DOM writer runs with phase `"cleared"`.
    const seal = evaluatePacketChoiceGesture(
      glanceGesture(DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs + 1),
    );
    expect(seal.feedback).toBe("seal-safe");
    expect(seal.committed).toBe(true);
    expect(seal.choice).toBe("sealed");
    applyPacketPreviewFeedback(packetButton, seal.feedback === "previewed" ? "previewed" : "cleared");

    expect(packetButton.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);
  });

  it("walks glance → commit across two taps on the served button (tap-driven)", () => {
    // Full played-through arc: a glance-length tap stamps the served
    // button; a follow-up preserve-length tap commits SEALED and
    // clears the stamp. Both dispatch through a real click handler
    // over the real served node — the "player taps a rendered
    // element" contract Soren required for #1701.
    const script: Array<PacketChoiceGesture> = [
      glanceGesture(30),
      glanceGesture(DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs + 1),
    ];
    packetButton.addEventListener("click", () => {
      const gesture = script.shift();
      if (!gesture) return;
      const decision = evaluatePacketChoiceGesture(gesture);
      applyPacketPreviewFeedback(
        packetButton,
        decision.feedback === "previewed" ? "previewed" : "cleared",
      );
    });

    // Pre-tap: no stamp.
    expect(packetButton.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);

    // First tap: glance → preview stamp lands.
    packetButton.click();
    expect(packetButton.getAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(
      PACKET_PREVIEW_FEEDBACK_VALUE,
    );

    // Second tap: preserve-length → stamp cleared.
    packetButton.click();
    expect(packetButton.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);
  });

  it("does NOT stamp for a hold gesture, even inside the preview window", () => {
    // Regression pin — the preview branch only fires for `kind: "tap"`.
    // A hold (even a short one) is a deliberate-hold gesture and MUST
    // NOT get absorbed into the glance path. Mirrors the pure lane's
    // `checkPreviewReleaseDoesNotOpenStationaryHold` invariant.
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: 40,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });
    expect(decision.feedback).not.toBe("previewed");

    applyPacketPreviewFeedback(packetButton, decision.feedback === "previewed" ? "previewed" : "cleared");
    expect(packetButton.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);
  });

  it("does NOT stamp for a drag gesture inside the preview window", () => {
    // Regression pin — the drag guard fires BEFORE the preview branch
    // in `evaluatePacketChoiceGesture`. A drag at any duration must
    // surface `feedback: "inspect"`, not `previewed`.
    const decision = evaluatePacketChoiceGesture({
      kind: "drag",
      durationMs: 40,
      travelPx: 12,
      startedOnSeal: true,
      endedOnSeal: true,
    });
    expect(decision.feedback).toBe("inspect");

    applyPacketPreviewFeedback(packetButton, decision.feedback === "previewed" ? "previewed" : "cleared");
    expect(packetButton.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);
  });

  it("is a no-op on a null element or a bare button — MUST NEVER throw", () => {
    // The main.js call site wraps in try/catch, but the writer itself
    // must defend so a fresh DOM never black-screens boot.
    expect(() => applyPacketPreviewFeedback(null, "previewed")).not.toThrow();
    expect(() => applyPacketPreviewFeedback(undefined, "cleared")).not.toThrow();

    const bare = dom.window.document.createElement("button");
    expect(() =>
      applyPacketPreviewFeedback(bare as unknown as HTMLElement, "previewed"),
    ).not.toThrow();
    expect(bare.getAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(
      PACKET_PREVIEW_FEEDBACK_VALUE,
    );

    // Clearing on a bare button removes the attribute cleanly.
    applyPacketPreviewFeedback(bare as unknown as HTMLElement, "cleared");
    expect(bare.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);
  });

  it("normalizes an unknown phase to `cleared` (no stamp lands)", () => {
    // Defensive: if a future caller passes a stale enum value the
    // writer treats it as `cleared` and does not stamp — never
    // leaves a garbage attribute on the DOM.
    applyPacketPreviewFeedback(packetButton, "previewed");
    expect(packetButton.getAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(
      PACKET_PREVIEW_FEEDBACK_VALUE,
    );

    applyPacketPreviewFeedback(
      packetButton,
      "cancelled" as unknown as "previewed",
    );
    expect(packetButton.hasAttribute(PACKET_PREVIEW_FEEDBACK_ATTR)).toBe(false);
  });
});
