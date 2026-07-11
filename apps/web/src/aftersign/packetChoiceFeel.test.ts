import { describe, expect, it } from "vitest";

import { evaluatePacketChoiceGesture } from "./packetChoiceFeel";

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
});
