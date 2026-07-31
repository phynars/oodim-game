import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  createAftersignVerticalSliceState,
  recordAftersignPacketChoice,
  resolveAftersignPacketConfirmInteraction,
  sampleAftersignPacketConfirmInteractionEnvelope,
} from "./verticalSliceState";

// Companion to the mid-tear frame pinned in durableSave.contract.test.ts
// ("advances the packet-open envelope halfway through the tear window",
// L605). That existing case locks the ROUTED sampler at t=0 and t=110 for
// `packetOpen`, and t=0 for `packetPreserve`. This file covers the three
// gaps in the ROUTED path (`sampleAftersignPacketConfirmInteractionEnvelope`,
// the wrapper in verticalSlicePacketInteraction.ts) that the durable-save
// suite does not touch:
//
//   1. Post-tear recoil frame — proves the branch where tearProgress is
//      clamped to 1 and cameraShakePx decays via 1 - (1 - recoilProgress)^3.
//   2. `reducedMotion` flag routing — proves the third positional arg on
//      the wrapper reaches the raw sampler and gates camera motion to the
//      acceptance floor while preserving progress/opacity/audio-relevant
//      values.
//   3. Inspect variant end-to-end — proves the `action: "inspect"` path
//      through `resolveAftersignPacketConfirmInteraction` composes with
//      the routed sampler and yields the triangular seal-glow peak shape,
//      not a tear envelope.
//
// The raw sampler is exercised in interactionFeelContract.test.ts; here we
// pin the wrapper that the runtime actually calls.
const PACKET_OPEN_FEEL = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetOpen;
const PACKET_INSPECT_FEEL = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetInspect;

describe("Aftersign packet-confirm routed sampler", () => {
  it("decays cameraShakePx through the recoil window after the tear completes", () => {
    // t = tearMs + recoilMs/2 = 220 + 60 = 280. Tear is done
    // (tearProgress clamps to 1, sealScale collapses to 1). recoil sits
    // at half its cubic-ease-out arc: recoilProgress = 0.5,
    // recoilEase = 1 - (1 - 0.5)^3 = 0.875, so
    // cameraShakePx = 1.5 * (1 - 0.875) = 0.1875 — the tail of the shake.
    // shard opacity has decayed further: 1 - 280/260 clamps to 0.
    const opened = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(opened);
    const elapsedMs = PACKET_OPEN_FEEL.tearMs + PACKET_OPEN_FEEL.recoilMs / 2;

    const envelope = sampleAftersignPacketConfirmInteractionEnvelope(
      kind,
      elapsedMs,
    );

    expect(envelope.kind).toBe("packetOpen");
    if (envelope.kind === "packetOpen") {
      expect(envelope.label).toBe("packet-open");
      expect(envelope.tearProgress).toBeCloseTo(1, 5);
      expect(envelope.sealScale).toBeCloseTo(1, 5);
      // 1.5 * (1 - (1 - 0.5)^3) mapped to residual = 1.5 * 0.125 = 0.1875.
      expect(envelope.cameraShakePx).toBeCloseTo(0.1875, 5);
      expect(envelope.waxShardOpacity).toBe(0);
    }
  });

  it("gates camera shake to zero under reducedMotion without stalling the tear ramp", () => {
    // Same 110ms mid-tear frame as the durable-save case, but with
    // reducedMotion=true. The tear ramp, seal collapse, and shard fade
    // must still run on time — only cameraShakePx should be forced to the
    // acceptance floor (0). This is what proves the third positional
    // argument on the wrapper actually reaches the raw sampler.
    const opened = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(opened);

    const reduced = sampleAftersignPacketConfirmInteractionEnvelope(
      kind,
      110,
      true,
    );

    expect(reduced.kind).toBe("packetOpen");
    if (reduced.kind === "packetOpen") {
      expect(reduced.tearProgress).toBeCloseTo(0.5, 5);
      expect(reduced.sealScale).toBeCloseTo(1.04, 5);
      expect(reduced.cameraShakePx).toBe(
        PACKET_OPEN_FEEL.acceptance.reducedMotionCameraShakePx,
      );
      // The shard opacity decay is timing, not motion — it must survive
      // the reducedMotion gate so the frame count of the beat is stable.
      expect(reduced.waxShardOpacity).toBeCloseTo(1 - 110 / 260, 5);
    }
  });

  it("routes the inspect action through resolve+sample to the triangular seal-glow peak", () => {
    // Inspect is a separate action ("inspect" — not tied to packetOutcome),
    // so it can be resolved from ANY committed state including sealed.
    // At elapsedMs = sealGlowPeakMs = 96 the triangular glow window is at
    // its peak (glowFalloff = 1), sealGlowPx = 10. settleProgress = 96/180
    // ≈ 0.5333, settleEase = 1 - (1 - 0.5333)^3 ≈ 0.8985, so
    // cameraNudgeDegrees = 0.35 * (1 - 0.8985) ≈ 0.03554 and
    // objectLiftPx = 6 * (1 - 0.8985) ≈ 0.6091.
    const sealed = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(sealed, "inspect");
    expect(kind).toBe("packetInspect");

    const envelope = sampleAftersignPacketConfirmInteractionEnvelope(
      kind,
      PACKET_INSPECT_FEEL.sealGlowPeakMs,
    );

    expect(envelope.kind).toBe("packetInspect");
    if (envelope.kind === "packetInspect") {
      expect(envelope.label).toBe("packet-inspect");
      const settleProgress =
        PACKET_INSPECT_FEEL.sealGlowPeakMs / PACKET_INSPECT_FEEL.settleMs;
      const settleEase = 1 - Math.pow(1 - settleProgress, 3);
      expect(envelope.settleProgress).toBeCloseTo(settleProgress, 5);
      // Peak of the triangular window — full glow.
      expect(envelope.sealGlowPx).toBeCloseTo(PACKET_INSPECT_FEEL.sealGlowPx, 5);
      expect(envelope.cameraNudgeDegrees).toBeCloseTo(
        PACKET_INSPECT_FEEL.cameraNudgeDegrees * (1 - settleEase),
        5,
      );
      expect(envelope.objectLiftPx).toBeCloseTo(
        PACKET_INSPECT_FEEL.objectLiftPx * (1 - settleEase),
        5,
      );
    }
  });
});
