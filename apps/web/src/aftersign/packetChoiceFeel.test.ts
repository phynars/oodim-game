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

  it("a hold that ends one millisecond short of openHoldMs must NOT open", () => {
    // Frame-boundary regression: the seal must not break on 419ms holds.
    const decision = evaluatePacketChoiceGesture({
      kind: "hold",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.openHoldMs - 1,
      travelPx: 0,
      startedOnSeal: true,
      endedOnSeal: true,
    });

    expect(decision.committed).toBe(false);
    expect(decision.choice).toBeNull();
    expect(decision.reason).toBe("inspect-only");
  });

  it("a tap one millisecond past preserveTapMaxMs must NOT commit preserve", () => {
    // Symmetric regression on the other end: 181ms is no longer a tap.
    const decision = evaluatePacketChoiceGesture({
      kind: "tap",
      durationMs: DEFAULT_PACKET_CHOICE_FEEL.preserveTapMaxMs + 1,
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
