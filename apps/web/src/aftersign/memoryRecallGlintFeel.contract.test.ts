import { describe, expect, it } from "vitest";
import {
  AFTERSIGN_MEMORY_RECALL_GLINT_FEEL,
  resolveAftersignMemoryRecallGlintEnvelope,
} from "./memoryRecallGlintFeel";

describe("AFTERSIGN memory recall glint feel", () => {
  it("pins the recall glint to a short visible shimmer with restrained camera motion", () => {
    expect(AFTERSIGN_MEMORY_RECALL_GLINT_FEEL).toMatchObject({
      durationMs: 840,
      glintLeadMs: 120,
      glintTravelPx: 72,
      glintWidthPx: 18,
      maxOpacity: 0.28,
      bloomLift: 0.14,
      audioDuckDb: -3,
      audioDuckHoldMs: 180,
      cameraDollyCm: 6,
      cameraYawDegrees: 1.2,
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
      cameraYawDegrees: 1.2,
    });
  });

  it("peaks near the center with readable shimmer but never exceeds the bloom budget", () => {
    const envelope = resolveAftersignMemoryRecallGlintEnvelope(480);

    expect(envelope.progress).toBeGreaterThan(0.55);
    expect(envelope.glintProgress).toBe(0.5);
    expect(envelope.glintOffsetPx).toBeGreaterThanOrEqual(30);
    expect(envelope.opacity).toBe(0.28);
    expect(envelope.bloomLift).toBe(0.14);
    expect(envelope.audioDuckDb).toBe(0);
    expect(envelope.cameraDollyCm).toBeLessThan(0.5);
    expect(envelope.cameraYawDegrees).toBeLessThan(0.1);
  });

  it("settles fully by 840ms with no leftover shake, duck, or bloom", () => {
    const envelope = resolveAftersignMemoryRecallGlintEnvelope(840);

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
