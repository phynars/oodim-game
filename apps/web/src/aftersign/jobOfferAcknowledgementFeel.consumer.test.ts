// Consumer test for `aftersign/src/jobOfferAcknowledgementFeel.js` — the
// main.js-facing "receipt beat" that plays on the acceptance line node
// right after a job offer is accepted (see aftersign/main.js:~2577).
//
// This test is the trip-wire Soren's PR #1964 REQUEST_CHANGES demanded
// (AI005: magic value outside the contract). Every sibling feel module
// (jobOfferFocusFeedback.consumer.test.ts, jobOfferChoiceFeedback.
// consumer.test.ts, returnToneChoiceFeel.consumer.test.ts) ships one,
// and without this file the 220ms duration, 6px rise, cubic-bezier
// easing, and 0 → 1 → 0.82 opacity arc are driftable magic values with
// zero assertions.
//
// NB: the aftersign WebGL e2e lane (flagship-reload-beat-regression)
// tripped a separate, orthogonal flake on this PR's CI — the story
// auto-advances io-return-recognition → return-tone-choice between
// the successful poll and a follow-up getSnapshot on cold SwiftShader
// runners (see #1966). The unblocker landed in the same iterate turn:
// `advanceToRecognition` now captures the snapshot INSIDE the winning
// poll iteration instead of re-fetching, so the (beat, lastLine) pair
// the poll validated is exactly what the caller asserts against. That
// fix lives in `aftersign/e2e/flagship-reload-beat-regression.spec.ts`
// and closes #1966; it does not change the acknowledgement-feel path.
//
// Scope pinned here:
//   1. `JOB_OFFER_ACKNOWLEDGEMENT_FEEL` exposes the shipped contract
//      (durationMs=220, risePx=6, peakOpacity=1, cubic-bezier easing)
//      and is frozen — a future author can't quietly mutate it.
//   2. `element.animate` is called with three keyframes whose opacity
//      arc is 0 → 1 → 0.82 and whose transform arc uses the shipped
//      6px rise → 0 → -1px settle.
//   3. The animate options carry the shipped duration, easing, and
//      `fill: "both"`.
//   4. Any in-flight animations on the same element are cancelled
//      before the receipt beat starts (so a rapid double-accept can't
//      pile two rise-and-settle beats on the same node).
//   5. Nullish element and missing-WAAPI browsers return `false` and
//      do not throw — the accept callback in main.js must never be
//      delayed or blocked by a feel module.
//
// Non-scope: this file does NOT re-pin the acceptance-copy text or the
// tray-layout stability (jobOfferChoiceFeedback / aftersignJobAccepted-
// Render own those). This test asserts the ACKNOWLEDGEMENT beat only,
// so drift in either half reds independently.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JOB_OFFER_ACKNOWLEDGEMENT_FEEL,
  playJobOfferAcknowledgementFeel,
} from "../../../../aftersign/src/jobOfferAcknowledgementFeel.js";

describe("jobOfferAcknowledgementFeel (main.js consumer)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("exposes a frozen contract with the shipped duration/rise/easing", () => {
    // These are the values wired into main.js's accept callback and
    // documented in the inline comment above the call site. If any
    // one drifts without this test being updated, the receipt beat's
    // "smaller than the job button's press recovery" invariant breaks
    // and it starts reading as a second competing tap target.
    expect(JOB_OFFER_ACKNOWLEDGEMENT_FEEL).toEqual({
      durationMs: 220,
      risePx: 6,
      peakOpacity: 1,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
    expect(Object.isFrozen(JOB_OFFER_ACKNOWLEDGEMENT_FEEL)).toBe(true);
  });

  it("calls element.animate with the shipped opacity/transform keyframes and options", () => {
    const el = document.createElement("div");
    document.body.append(el);
    const animate = vi.fn();
    const getAnimations = vi.fn(() => []);
    (el as unknown as { animate: typeof animate }).animate = animate;
    (el as unknown as { getAnimations: typeof getAnimations }).getAnimations =
      getAnimations;

    const scheduled = playJobOfferAcknowledgementFeel(el);
    expect(scheduled).toBe(true);
    expect(animate).toHaveBeenCalledTimes(1);

    const [keyframes, options] = animate.mock.calls[0]! as [
      Array<Record<string, unknown>>,
      Record<string, unknown>,
    ];

    // Three keyframes — start (invisible, risen), peak (opaque, home),
    // residue (0.82 opacity, -1px settle). The residue keyframe is the
    // "receipt lingers a beat" cue that separates this feel from a
    // plain fade-in; if it drifts to 1 or drops the -1px settle the
    // acknowledgement stops reading as a receipt.
    expect(keyframes).toHaveLength(3);

    // Opacity arc: 0 → peakOpacity (1) → 0.82 residue.
    expect(keyframes[0]!.opacity).toBe(0);
    expect(keyframes[1]!.opacity).toBe(JOB_OFFER_ACKNOWLEDGEMENT_FEEL.peakOpacity);
    expect(keyframes[2]!.opacity).toBe(0.82);

    // Transform arc: 6px rise + subtle 0.985 scale → home → -1px settle.
    // Assert the shipped risePx token appears in the start keyframe
    // (so renaming the token here reds the test), and pin the settle.
    expect(typeof keyframes[0]!.transform).toBe("string");
    expect(keyframes[0]!.transform as string).toContain(
      `${JOB_OFFER_ACKNOWLEDGEMENT_FEEL.risePx}px`,
    );
    expect(keyframes[0]!.transform as string).toContain("scale(0.985)");
    expect(keyframes[1]!.transform).toBe("translate3d(0, 0, 0) scale(1)");
    expect(keyframes[2]!.transform).toBe("translate3d(0, -1px, 0) scale(1)");

    // Options: shipped duration + easing + fill:"both" (so the -1px
    // residue holds after the animation ends instead of snapping home).
    expect(options).toEqual({
      duration: JOB_OFFER_ACKNOWLEDGEMENT_FEEL.durationMs,
      easing: JOB_OFFER_ACKNOWLEDGEMENT_FEEL.easing,
      fill: "both",
    });
  });

  it("cancels any in-flight animations on the same element before starting", () => {
    // Rapid double-accept path: the receipt beat must NOT pile on top
    // of a still-running instance from a previous accept — that would
    // stack the -1px settle offsets and drift the copy off-baseline.
    const el = document.createElement("div");
    document.body.append(el);
    const cancelA = vi.fn();
    const cancelB = vi.fn();
    const getAnimations = vi.fn(() => [{ cancel: cancelA }, { cancel: cancelB }]);
    const animate = vi.fn();
    (el as unknown as { getAnimations: typeof getAnimations }).getAnimations =
      getAnimations;
    (el as unknown as { animate: typeof animate }).animate = animate;

    playJobOfferAcknowledgementFeel(el);

    expect(getAnimations).toHaveBeenCalledTimes(1);
    expect(cancelA).toHaveBeenCalledTimes(1);
    expect(cancelB).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("returns false and does nothing when element is nullish", () => {
    // Defensive path — same shape as the sibling feel modules. The
    // accept callback in main.js may call this before the acceptance
    // node is in the DOM if a future refactor reorders the writes.
    expect(playJobOfferAcknowledgementFeel(null)).toBe(false);
    expect(playJobOfferAcknowledgementFeel(undefined)).toBe(false);
    // No throws.
    expect(() => playJobOfferAcknowledgementFeel(null)).not.toThrow();
  });

  it("returns false when the browser has no Web Animations API", () => {
    // jsdom's HTMLElement has no `.animate`. Without an explicit spy
    // the module's `typeof element.animate !== "function"` guard fires
    // — this asserts the guard, not the animation. The accept path
    // must never throw on a WAAPI-less browser (older Safari, some
    // WebViews); it just skips the receipt beat.
    const el = document.createElement("div");
    document.body.append(el);
    // Sanity: jsdom really did not attach a WAAPI shim on this build.
    expect(typeof (el as unknown as { animate?: unknown }).animate).not.toBe(
      "function",
    );

    expect(playJobOfferAcknowledgementFeel(el)).toBe(false);
  });
});
