import { describe, expect, it } from "vitest";
import { MEMORY_RECALL_FEEL } from "./memoryRecallFeel";
import {
  AFTERSIGN_MEMORY_RECALL_GLINT_FEEL,
  resolveAftersignMemoryRecallGlintEnvelope,
} from "./memoryRecallGlintFeel";

describe("AFTERSIGN memory recall glint feel", () => {
  it("pins the recall glint to a short visible shimmer with restrained camera motion", () => {
    // The glint inherits its duration and camera-yaw ceiling from the
    // wired recall beat (`MEMORY_RECALL_FEEL`) — no divergent numbers.
    expect(AFTERSIGN_MEMORY_RECALL_GLINT_FEEL).toMatchObject({
      durationMs: MEMORY_RECALL_FEEL.durationMs,
      glintLeadMs: 120,
      glintTravelPx: 72,
      glintWidthPx: 18,
      maxOpacity: 0.28,
      bloomLift: 0.14,
      audioDuckDb: -3,
      audioDuckHoldMs: 180,
      cameraDollyCm: 6,
      cameraYawDegrees: MEMORY_RECALL_FEEL.cameraYawDeg,
      easing: "cubic-bezier(.16,1,.3,1)",
    });
  });

  it("starts with a tiny camera lean and a brief audio duck before the glint travels", () => {
    const envelope = resolveAftersignMemoryRecallGlintEnvelope(0);

    expect(envelope).toMatchObject({
      progress: 0,
      glintProgress: 0,
      glintOffsetPx: -36,
      glintWidthPx: 18,
      opacity: 0,
      bloomLift: 0,
      audioDuckDb: -3,
      cameraDollyCm: 6,
      cameraYawDegrees: MEMORY_RECALL_FEEL.cameraYawDeg,
    });
  });

  it("peaks near the center with readable shimmer but never exceeds the bloom budget", () => {
    // 120ms lead + half of (760-120) = 120 + 320 = 440ms → glintProgress=0.5
    const envelope = resolveAftersignMemoryRecallGlintEnvelope(440);

    expect(envelope.progress).toBeGreaterThan(0.5);
    expect(envelope.glintProgress).toBeCloseTo(0.5, 5);
    expect(envelope.glintOffsetPx).toBeGreaterThanOrEqual(30);
    expect(envelope.opacity).toBeCloseTo(0.28, 3);
    expect(envelope.bloomLift).toBeCloseTo(0.14, 3);
    expect(envelope.audioDuckDb).toBe(0);
    expect(envelope.cameraDollyCm).toBeLessThan(0.5);
    expect(envelope.cameraYawDegrees).toBeLessThan(0.1);
  });

  it("settles fully by the beat's end with no leftover shake, duck, or bloom", () => {
    const envelope = resolveAftersignMemoryRecallGlintEnvelope(
      MEMORY_RECALL_FEEL.durationMs,
    );

    expect(envelope).toMatchObject({
      progress: 1,
      glintProgress: 1,
      glintOffsetPx: 36,
      opacity: 0,
      bloomLift: 0,
      audioDuckDb: 0,
      cameraDollyCm: 0,
      cameraYawDegrees: 0,
    });
  });
});
