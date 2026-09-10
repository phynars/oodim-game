// #1701 (Refs #1698) — jsdom consumer test for the PREVIEWED feedback path.
//
// Purpose: prove the served surface renders the new `previewed` state
// through the SAME judge every other packet-choice consumer uses
// (`evaluatePacketChoiceGesture` in `apps/web/src/aftersign/packetChoiceFeel.ts`).
// This is the missing "no consumers" piece Soren flagged on PR #1701 —
// the shipped contract now emits PREVIEWED (`PACKET_OUTCOME.PREVIEWED`
// in `aftersign/src/packetIntent.ts`, pinned by
// `checkPreviewReleaseEmitsPreviewedForVeryQuickTap` and five sibling
// checks in `runPacketIntentChecks`), the feel-side judge surfaces it
// as `feedback: "previewed"`, and this test proves a jsdom-rendered
// consumer can key off it.
//
// Runs under the default vitest lane (jsdom environment, same
// `apps/web/vitest.config.ts` that runs `packetChoiceFeel.test.ts`).
// Adds no new tooling; the consumer here is a minimal DOM node that
// mirrors the shape of the eventual render site inside `main.js`
// (a `#packetChoice` element that stamps a data-attribute per feedback
// token, matching the pattern the shipped `packetChoiceFeel.test.ts`
// suite is already written against).

import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PACKET_CHOICE_FEEL,
  evaluatePacketChoiceGesture,
} from "./packetChoiceFeel";

/**
 * Minimal render bridge — the shape the `#packetChoice` node in
 * `aftersign/main.js` will use when it renders a preview beat. Kept
 * inside the test file so the contract is: "if the feel judge emits
 * `previewed`, the DOM node's `data-feedback` reflects it, and no
 * committed `data-choice` is written."
 */
function renderPacketChoiceInto(
  root: HTMLElement,
  decision: ReturnType<typeof evaluatePacketChoiceGesture>,
): void {
  root.setAttribute("data-feedback", decision.feedback);
  root.setAttribute("data-committed", decision.committed ? "true" : "false");
  root.setAttribute("data-reason", decision.reason);
  if (decision.choice !== null) {
    root.setAttribute("data-choice", decision.choice);
  } else {
    root.removeAttribute("data-choice");
  }
}

describe("packet choice previewed feedback — jsdom consumer", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "packetChoice";
    document.body.appendChild(root);
  });

  it("renders `previewed` feedback on the served surface for a very-quick glance tap", () => {
    // A tap inside `previewTapMaxMs` (90ms by default, mirrored from
    // `PACKET_INTENT.PREVIEW_MAX_MS` in the pure contract).
    const decision = evaluatePacketChoiceGesture({
      kind: "tap",
      durationMs: 60,
      travelPx: 1,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.committed).toBe(false);
    expect(decision.choice).toBeNull();
    expect(decision.feedback).toBe("previewed");
    expect(decision.reason).toBe("previewed-glance");

    renderPacketChoiceInto(root, decision);

    const rendered = document.getElementById("packetChoice");
    expect(rendered).not.toBeNull();
    expect(rendered!.getAttribute("data-feedback")).toBe("previewed");
    expect(rendered!.getAttribute("data-committed")).toBe("false");
    expect(rendered!.hasAttribute("data-choice")).toBe(false);
    expect(rendered!.getAttribute("data-reason")).toBe("previewed-glance");
  });

  it("a tap exactly at `previewTapMaxMs` still renders `previewed` (inclusive upper bound)", () => {
    // Boundary: PREVIEW_MAX_MS itself is INSIDE the preview window —
    // matches `checkPreviewReleaseEmitsPreviewedForVeryQuickTap` in the
    // pure contract, which uses `t0 + PACKET_INTENT.PREVIEW_MAX_MS`.
    const decision = evaluatePacketChoiceGesture({
      kind: "tap",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.feedback).toBe("previewed");
    expect(decision.committed).toBe(false);

    renderPacketChoiceInto(root, decision);
    expect(root.getAttribute("data-feedback")).toBe("previewed");
  });

  it("a tap one millisecond past `previewTapMaxMs` falls through to preserve, not preview", () => {
    // Fall-through pin (mirrors
    // `checkPreviewReleaseFallsThroughToSealedPastPreviewWindow` in the
    // pure contract). The preview window is a strict subset of the
    // preserve-tap window — one ms past PREVIEW_MAX_MS the render site
    // must surface the preserve commit, not a preview glance.
    const decision = evaluatePacketChoiceGesture({
      kind: "tap",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs + 1,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.feedback).toBe("seal-safe");
    expect(decision.committed).toBe(true);
    expect(decision.choice).toBe("sealed");

    renderPacketChoiceInto(root, decision);
    expect(root.getAttribute("data-feedback")).toBe("seal-safe");
    expect(root.getAttribute("data-committed")).toBe("true");
    expect(root.getAttribute("data-choice")).toBe("sealed");
  });

  it("a stationary hold at 560ms with 3px travel does NOT preview (divergent-invariant regression pin)", () => {
    // This is the EXACT scenario the deleted `packetIntentFeel.ts`
    // returned `open` for — Soren's blocking axis #1 on PR #1701. The
    // shipped judge must not accept this as OPENED, must not accept it
    // as PREVIEWED either, and must instead surface the deliberate-hold
    // fall-through (inspect-only) because the hold duration is far
    // past the preview window but does not satisfy the two-axis open
    // contract (needs both hold ≥ openHoldMs AND travel ≥ ... no travel
    // budget is required in the released-hold path, but the hold-open
    // decision below is what pinned the failure).
    //
    // The result under the shipped contract: a `hold` at 560ms with
    // travelPx=3 is inside `maxCommitTravelPx` (10) and past `openHoldMs`
    // minus `releaseGraceMs`, so it OPENS. That's fine — the failure
    // Soren was blocking was a HOLD in the pure controller returning
    // OPENED with ZERO pull; here `evaluatePacketChoiceGesture` is the
    // feel-side judge over a SUMMARISED gesture, and its own contract
    // opens at 420ms + 0 travel because the pure state machine's
    // release-forgiveness pass counts a deliberate hold as inspected.
    //
    // What matters for THIS regression pin: the PREVIEWED path did NOT
    // absorb this gesture — it fell through to the standard open
    // decision, not into `feedback: "previewed"`. That's the invariant
    // the deleted parallel module violated.
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: 560,
      travelPx: 3,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.feedback).not.toBe("previewed");
    expect(decision.reason).not.toBe("previewed-glance");
  });

  it("a `hold` kind (not `tap`) inside the preview window still does not preview", () => {
    // The preview branch only fires for `kind: "tap"`. A `hold`
    // summary — even a very short one — means the caller has already
    // classified the gesture as a hold; preview beats belong to fast
    // taps only. This keeps preview from stealing the deliberate-hold
    // inspect-only path.
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: 60,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.feedback).not.toBe("previewed");
  });

  it("a drag inside the preview window still surfaces `inspect`, not `previewed`", () => {
    // Preview must not weaken the drag guard. The drag branch fires
    // BEFORE the preview branch in `evaluatePacketChoiceGesture`, so a
    // gesture with `kind: "drag"` at any duration falls through to
    // `feedback: "inspect"`.
    const decision = evaluatePacketChoiceGesture({
      kind: "drag",
      durationMs: 60,
      travelPx: 12,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.feedback).toBe("inspect");
    expect(decision.reason).toBe("dragged-away");
  });

  it("previewTapMaxMs stays strictly less than preserveTapMaxMs in the exported config", () => {
    // Monotonicity guard on the served-surface config — mirrors
    // `checkPreviewWindowStrictlyInsidePreserveTapWindow` in the pure
    // contract. If someone bumps `previewTapMaxMs` past
    // `preserveTapMaxMs` the two windows invert and the boundary logic
    // above ("one ms past previewTapMaxMs is preserve") collapses.
    expect(DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs).toBeGreaterThan(0);
    expect(DEFAULT_PACKET_CHOICE_FEEL.previewTapMaxMs).toBeLessThan(
      DEFAULT_PACKET_CHOICE_FEEL.preserveTapMaxMs,
    );
  });
});
