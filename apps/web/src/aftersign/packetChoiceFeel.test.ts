import { describe, expect, it } from "vitest";

import {
  DEFAULT_PACKET_CHOICE_FEEL,
  evaluatePacketChoiceGesture,
} from "./packetChoiceFeel";

describe("evaluatePacketChoiceGesture", () => {
  it("does not open the packet from a short accidental touch", () => {
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: 140,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision).toEqual({
      choice: null,
      committed: false,
      feedback: "seal-strain",
      reason: "inspect-only",
    });
  });

  it("requires a deliberate hold on the seal to open the packet", () => {
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: 430,
      travelPx: 4,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision).toEqual({
      choice: "opened",
      committed: true,
      feedback: "seal-break",
      reason: "hold-opened",
    });
  });

  it("treats a quick seal tap as an intentional preserve choice", () => {
    const decision = evaluatePacketChoiceGesture({
      kind: "tap",
      durationMs: 120,
      travelPx: 2,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision).toEqual({
      choice: "sealed",
      committed: true,
      feedback: "seal-safe",
      reason: "tap-preserved",
    });
  });

  it("ignores drags so navigation cannot accidentally commit the packet choice", () => {
    const decision = evaluatePacketChoiceGesture({
      kind: "drag",
      durationMs: 520,
      travelPx: 24,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision).toEqual({
      choice: null,
      committed: false,
      feedback: "inspect",
      reason: "dragged-away",
    });
  });

  it("ignores gestures that start or end away from the seal", () => {
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: 800,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: false,
    });

    expect(decision).toEqual({
      choice: null,
      committed: false,
      feedback: "none",
      reason: "not-on-seal",
    });
  });

  // Regression asserts for the specific feel bugs the deleted
  // packetChoiceIntentFeel.ts tried (and failed) to catch. These live on the
  // one true judge so behaviour cannot drift again.

  it("a hold that ends one millisecond short of openHoldMs still opens (release forgiveness)", () => {
    // PR #994 wire-in: a finger-up frame one ms short of the hard threshold
    // was almost always the intended commit. `releaseGraceMs` now forgives
    // it. The pure-lane state machine
    // (aftersign/src/feel/packetChoiceReleaseForgiveness.ts) pins the same
    // behaviour with `checkReleaseOnFirstEligibleOpenFrameCommits`.
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.openHoldMs - 1,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.committed).toBe(true);
    expect(decision.choice).toBe("opened");
    expect(decision.reason).toBe("hold-opened");
  });

  it("a hold that ends BEYOND the release-forgiveness window still does not open", () => {
    // The forgiveness has a hard boundary — one ms past
    // `openHoldMs - releaseGraceMs - 1` must still fall through to
    // `inspect-only`, otherwise the sharp intent-boundary erodes over time.
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs:
        DEFAULT_PACKET_CHOICE_FEEL.openHoldMs -
        DEFAULT_PACKET_CHOICE_FEEL.releaseGraceMs -
        1,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.committed).toBe(false);
    expect(decision.choice).toBeNull();
    expect(decision.reason).toBe("inspect-only");
  });

  it("a tap one millisecond past preserveTapMaxMs still commits preserve (release forgiveness)", () => {
    // Symmetric wire-in on the preserve side: a tap that overruns the tap
    // ceiling by less than `releaseGraceMs` is still the "quick tap"
    // preserve intent. Matches the state-machine invariant
    // `checkReleaseOnFirstEligiblePreserveFrameCommits`.
    const decision = evaluatePacketChoiceGesture({
      kind: "tap",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.preserveTapMaxMs + 1,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.committed).toBe(true);
    expect(decision.choice).toBe("sealed");
    expect(decision.reason).toBe("tap-preserved");
  });

  it("a tap BEYOND the preserve release-forgiveness window no longer commits", () => {
    // Hard boundary on the preserve side too: `releaseGraceMs + 1` past
    // `preserveTapMaxMs` is no longer a tap. Keeps the sharp intent-boundary
    // alive at the new (grace-inclusive) edge.
    const decision = evaluatePacketChoiceGesture({
      kind: "tap",
      durationMs:
        DEFAULT_PACKET_CHOICE_FEEL.preserveTapMaxMs +
        DEFAULT_PACKET_CHOICE_FEEL.releaseGraceMs +
        1,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.committed).toBe(false);
    expect(decision.choice).toBeNull();
  });

  it("a hold that crosses the travel budget by 1px is a drag, not an open", () => {
    // Travel budget must not be inclusive-of-overshoot. Even a long hold that
    // moves 11px is aiming, not committing.
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: 900,
      travelPx: DEFAULT_PACKET_CHOICE_FEEL.maxCommitTravelPx + 1,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision).toEqual({
      choice: null,
      committed: false,
      feedback: "inspect",
      reason: "dragged-away",
    });
  });

  it("a cancel gesture never commits, even at open-hold duration on the seal", () => {
    // If input plumbing marks a gesture cancelled (blur, pointer capture loss),
    // the judge must not confirm either choice.
    const decision = evaluatePacketChoiceGesture({
      kind: "cancel",
      durationMs: 800,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision).toEqual({
      choice: null,
      committed: false,
      feedback: "none",
      reason: "cancelled",
    });
  });
});
