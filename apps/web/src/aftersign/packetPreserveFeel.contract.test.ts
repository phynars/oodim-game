import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  createAftersignVerticalSliceState,
  recordAftersignPacketChoice,
  resolveAftersignPacketConfirmInteraction,
  sampleAftersignPacketConfirmInteractionEnvelope,
} from "./verticalSliceState";

// Companion to packetOpenFeel.contract.test.ts — that file pins three
// gaps on the ROUTED sampler for `packetOpen` (post-tear recoil,
// reducedMotion routing, inspect-action composition). The equivalent
// gaps for `packetPreserve` through the ROUTED path
// (`resolveAftersignPacketConfirmInteraction` → `sampleAftersignPacketConfirmInteractionEnvelope`)
// were not previously pinned:
//
//   • durableSave.contract.test.ts:713 pins only t=0 for packetPreserve
//     (`pulseProgress: 0`, sealScale ≈ 1, humDuckDb ≈ signHumDuckDb).
//   • interactionFeelContract.test.ts exercises the RAW sampler for
//     packetPreserve crest/end + reducedMotion — but NOT the wrapper.
//
// This file covers the routed wrapper for packetPreserve at the crest
// and end of the half-sine, and pins that the wrapper propagates the
// `reducedMotion` gate to the packetPreserve branch (sealScale forced
// to `acceptance.reducedMotionSealPulseScale` while pulseProgress and
// humDuckDb — timing/audio channels — still run).
//
// Every expected number below is derived from the LIVE
// `AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve` values (not
// re-typed). If a feel number moves, this test moves with it — the
// assertions read from the constant, not from a copy.
const PACKET_PRESERVE_FEEL = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve;

describe("Aftersign packet-preserve routed sampler", () => {
  it("crests the half-sine seal pulse at sealPulseMs/2 through the wrapper", () => {
    // packetPreserve is the `sealed` branch of the packetOutcome fork —
    // the routed wrapper must resolve to `packetPreserve` kind from the
    // sealed state, and sampling at sealPulseMs/2 must hit the crest of
    // the half-sine: pulseProgress = 0.5, sin(0.5π) = 1, so
    // sealScale = 1 + (sealPulseScale - 1) * 1 = sealPulseScale.
    // humDuckDb decays linearly: signHumDuckDb * (1 - 0.5) = -1.5.
    const sealed = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(sealed);
    expect(kind).toBe("packetPreserve");

    const crest = sampleAftersignPacketConfirmInteractionEnvelope(
      kind,
      PACKET_PRESERVE_FEEL.sealPulseMs / 2,
    );

    expect(crest.kind).toBe("packetPreserve");
    if (crest.kind === "packetPreserve") {
      expect(crest.label).toBe("packet-preserve");
      expect(crest.pulseProgress).toBeCloseTo(0.5, 5);
      expect(crest.sealScale).toBeCloseTo(PACKET_PRESERVE_FEEL.sealPulseScale, 5);
      expect(crest.humDuckDb).toBeCloseTo(
        PACKET_PRESERVE_FEEL.signHumDuckDb * 0.5,
        5,
      );
    }
  });

  it("settles the seal back to unit scale and hum to zero at sealPulseMs", () => {
    // At t = sealPulseMs the pulse completes: pulseProgress clamps to 1,
    // sin(π) = 0 so sealScale returns to 1, and the linear duck reaches
    // 0 (the sign hum comes back up under the closing pulse).
    const sealed = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(sealed);

    const end = sampleAftersignPacketConfirmInteractionEnvelope(
      kind,
      PACKET_PRESERVE_FEEL.sealPulseMs,
    );

    expect(end.kind).toBe("packetPreserve");
    if (end.kind === "packetPreserve") {
      expect(end.pulseProgress).toBe(1);
      expect(end.sealScale).toBeCloseTo(1, 5);
      expect(end.humDuckDb).toBeCloseTo(0, 5);
    }
  });

  it("pins sealScale to the reducedMotion floor while keeping pulseProgress and humDuckDb live", () => {
    // Sampling at the crest with reducedMotion=true through the wrapper
    // must force sealScale to `acceptance.reducedMotionSealPulseScale`
    // (= 1 — "seal never breaks during confirm"), while pulseProgress
    // (frame-count timing) and humDuckDb (audio channel) still resolve
    // to their unreduced values. This is the third-positional-argument
    // routing check for the packetPreserve branch.
    const sealed = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(sealed);

    const reduced = sampleAftersignPacketConfirmInteractionEnvelope(
      kind,
      PACKET_PRESERVE_FEEL.sealPulseMs / 2,
      true,
    );

    expect(reduced.kind).toBe("packetPreserve");
    if (reduced.kind === "packetPreserve") {
      expect(reduced.sealScale).toBe(
        PACKET_PRESERVE_FEEL.acceptance.reducedMotionSealPulseScale,
      );
      expect(reduced.sealScale).toBe(1);
      expect(reduced.pulseProgress).toBeCloseTo(0.5, 5);
      expect(reduced.humDuckDb).toBeCloseTo(
        PACKET_PRESERVE_FEEL.signHumDuckDb * 0.5,
        5,
      );
    }
  });
});
