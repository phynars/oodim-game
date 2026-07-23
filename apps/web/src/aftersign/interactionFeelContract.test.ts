import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  sampleAftersignInteractionConfirmEnvelope,
} from "./interactionFeelContract";

describe("Aftersign interaction-confirm envelope sampler", () => {
  describe("packetInspect (settle + triangular seal glow)", () => {
    const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetInspect;

    it("starts at rest and eases out to zero over settleMs", () => {
      const t0 = sampleAftersignInteractionConfirmEnvelope("packetInspect", 0);
      const tEnd = sampleAftersignInteractionConfirmEnvelope(
        "packetInspect",
        feel.settleMs,
      );

      expect(t0).toMatchObject({
        kind: "packetInspect",
        label: "packet-inspect",
        settleProgress: 0,
        cameraNudgeDegrees: feel.cameraNudgeDegrees,
        objectLiftPx: feel.objectLiftPx,
      });
      expect(tEnd.settleProgress).toBe(1);
      expect(tEnd.cameraNudgeDegrees).toBeCloseTo(0, 10);
      expect(tEnd.objectLiftPx).toBeCloseTo(0, 10);
    });

    it("peaks the seal glow exactly at sealGlowPeakMs and returns to zero at 2 * peak", () => {
      const before = sampleAftersignInteractionConfirmEnvelope(
        "packetInspect",
        0,
      );
      const atPeak = sampleAftersignInteractionConfirmEnvelope(
        "packetInspect",
        feel.sealGlowPeakMs,
      );
      const afterPeak = sampleAftersignInteractionConfirmEnvelope(
        "packetInspect",
        feel.sealGlowPeakMs * 2,
      );

      expect(before.sealGlowPx).toBeCloseTo(0, 10);
      expect(atPeak.sealGlowPx).toBeCloseTo(feel.sealGlowPx, 10);
      expect(afterPeak.sealGlowPx).toBeCloseTo(0, 10);
    });

    it("clamps negative elapsedMs to zero rather than sampling backward", () => {
      const clamped = sampleAftersignInteractionConfirmEnvelope(
        "packetInspect",
        -50,
      );
      const zero = sampleAftersignInteractionConfirmEnvelope(
        "packetInspect",
        0,
      );
      expect(clamped).toEqual(zero);
    });

    it("zeros camera nudge under reducedMotion but keeps the visual settle progress", () => {
      const reduced = sampleAftersignInteractionConfirmEnvelope(
        "packetInspect",
        feel.sealGlowPeakMs,
        true,
      );

      expect(reduced.cameraNudgeDegrees).toBe(
        feel.acceptance.reducedMotionCameraNudgeDegrees,
      );
      expect(reduced.settleProgress).toBeGreaterThan(0);
    });
  });

  describe("packetOpen (snap-then-decay scale, cubic recoil)", () => {
    const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetOpen;

    it("holds seal at snap scale on t=0 and collapses to 1 at tearMs", () => {
      const t0 = sampleAftersignInteractionConfirmEnvelope("packetOpen", 0);
      const tTear = sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        feel.tearMs,
      );

      expect(t0.kind).toBe("packetOpen");
      expect(t0.sealScale).toBeCloseTo(feel.sealSnapScale, 10);
      expect(t0.tearProgress).toBe(0);
      expect(tTear.sealScale).toBeCloseTo(1, 10);
      expect(tTear.tearProgress).toBe(1);
    });

    it("holds full camera shake before tearMs, then eases it out to zero by tearMs + recoilMs", () => {
      const beforeRecoil = sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        feel.tearMs,
      );
      const afterRecoil = sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        feel.tearMs + feel.recoilMs,
      );

      expect(beforeRecoil.cameraShakePx).toBeCloseTo(feel.cameraShakePx, 10);
      expect(afterRecoil.cameraShakePx).toBeCloseTo(0, 10);
    });

    it("decays wax shard opacity to zero by waxShardLifeMs", () => {
      const mid = sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        feel.waxShardLifeMs / 2,
      );
      const dead = sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        feel.waxShardLifeMs,
      );
      const past = sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        feel.waxShardLifeMs * 2,
      );

      expect(mid.waxShardOpacity).toBeCloseTo(0.5, 10);
      expect(dead.waxShardOpacity).toBeCloseTo(0, 10);
      expect(past.waxShardOpacity).toBe(0);
    });

    it("zeros camera shake under reducedMotion without breaking the tear progress", () => {
      const reduced = sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        feel.tearMs / 2,
        true,
      );

      expect(reduced.cameraShakePx).toBe(
        feel.acceptance.reducedMotionCameraShakePx,
      );
      expect(reduced.tearProgress).toBeCloseTo(0.5, 10);
    });
  });

  describe("packetPreserve (half-sine pulse, hum duck)", () => {
    const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve;

    it("crests the seal pulse at the midpoint of sealPulseMs and settles at 1", () => {
      const t0 = sampleAftersignInteractionConfirmEnvelope("packetPreserve", 0);
      const crest = sampleAftersignInteractionConfirmEnvelope(
        "packetPreserve",
        feel.sealPulseMs / 2,
      );
      const end = sampleAftersignInteractionConfirmEnvelope(
        "packetPreserve",
        feel.sealPulseMs,
      );

      expect(t0.sealScale).toBeCloseTo(1, 10);
      expect(crest.sealScale).toBeCloseTo(feel.sealPulseScale, 10);
      expect(end.sealScale).toBeCloseTo(1, 10);
    });

    it("ducks the sign hum linearly to zero over the pulse window", () => {
      const t0 = sampleAftersignInteractionConfirmEnvelope("packetPreserve", 0);
      const end = sampleAftersignInteractionConfirmEnvelope(
        "packetPreserve",
        feel.sealPulseMs,
      );

      expect(t0.humDuckDb).toBeCloseTo(feel.signHumDuckDb, 10);
      expect(end.humDuckDb).toBeCloseTo(0, 10);
    });

    it("pins seal at unit scale under reducedMotion (seal never breaks during confirm)", () => {
      const reduced = sampleAftersignInteractionConfirmEnvelope(
        "packetPreserve",
        feel.sealPulseMs / 2,
        true,
      );

      expect(reduced.sealScale).toBe(
        feel.acceptance.reducedMotionSealPulseScale,
      );
      expect(reduced.sealScale).toBe(1);
    });
  });

  it("rejects non-finite elapsedMs instead of returning NaN-poisoned envelopes", () => {
    expect(() =>
      sampleAftersignInteractionConfirmEnvelope("packetInspect", Number.NaN),
    ).toThrow(/elapsedMs must be finite/);
    expect(() =>
      sampleAftersignInteractionConfirmEnvelope(
        "packetOpen",
        Number.POSITIVE_INFINITY,
      ),
    ).toThrow(/elapsedMs must be finite/);
  });
});
