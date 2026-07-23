// AFTERSIGN interaction-confirm feel — the three-way packet decision.
//
// SOURCE STATUS: these numbers are ORIGINATED here — they are NOT re-exports
// of `DELIVER_PACKET_CONFIRM_FEEL` (that constant, in
// `packages/aftersign/src/interactionConfirm.ts`, models a single generic
// "deliver-packet-confirm" cue: pulseMs / phoneLiftPx / shakePx / ringEase).
// The flagship's packet moment is three distinct tactile answers:
//
//   packetInspect  — player tilts the packet, sees the seal, doesn't commit.
//                    Soft settle back to rest. Camera nudges, seal glows.
//   packetOpen     — player tears the seal. Wax snaps, shards, camera recoil.
//   packetPreserve — player commits to keeping the seal intact. Reassuring
//                    pulse, sign-hum ducks under a soft bell.
//
// The generic confirm doesn't distinguish these, so this file is the single
// authored source for the three shapes. `verticalSliceState.ts` is the live
// consumer: `resolveAftersignPacketConfirmInteraction` maps the committed
// `packetOutcome` to the right kind, and `sampleAftersignInteractionConfirmEnvelope`
// produces the per-frame envelope the renderer reads.
//
// If a future refactor lifts these into a package (`packages/aftersign/`), do
// the move + delete this file in the SAME PR — don't leave two copies.
//
// TEST: `interactionFeelContract.test.ts` pins the easing/clamping math
// (triangular seal-glow peak, cubic ease-out settle, snap-then-decay scale,
// reducedMotion gates). Do not change the numbers without updating that test.

export const AFTERSIGN_INTERACTION_CONFIRM_FEEL = {
  packetInspect: {
    label: "packet-inspect",
    pressDipMs: 54,
    settleMs: 180,
    cameraNudgeDegrees: 0.35,
    objectLiftPx: 6,
    sealGlowPx: 10,
    sealGlowPeakMs: 96,
    audio: {
      cue: "paper-thumb",
      leadMs: 0,
      peakMs: 42,
      maxDb: -14,
    },
    acceptance: {
      reducedMotionCameraNudgeDegrees: 0,
      maxEnvelopeMs: 180,
      visibleSealGlowWithinMs: 96,
    },
  },
  packetOpen: {
    label: "packet-open",
    pressDipMs: 54,
    tearMs: 220,
    recoilMs: 120,
    cameraShakePx: 1.5,
    sealSnapScale: 1.08,
    waxShardCount: 5,
    waxShardLifeMs: 260,
    audio: {
      cue: "wax-snap-paper-tear",
      snapPeakMs: 36,
      tearPeakMs: 128,
      maxDb: -12,
    },
    acceptance: {
      reducedMotionCameraShakePx: 0,
      shardCount: 5,
      openedStateVisibleWithinMs: 220,
    },
  },
  packetPreserve: {
    label: "packet-preserve",
    pressDipMs: 54,
    settleMs: 180,
    sealPulseScale: 1.04,
    sealPulseMs: 160,
    signHumDuckDb: -3,
    audio: {
      cue: "wax-confirm-soft-bell",
      bellDelayMs: 72,
      maxDb: -16,
    },
    acceptance: {
      reducedMotionSealPulseScale: 1,
      sealNeverBreaksDuringConfirm: true,
      confirmationVisibleWithinMs: 180,
    },
  },
} as const;

export type AftersignInteractionConfirmKind = keyof typeof AFTERSIGN_INTERACTION_CONFIRM_FEEL;

export type AftersignInteractionConfirmEnvelope =
  | {
      kind: "packetInspect";
      label: "packet-inspect";
      settleProgress: number;
      cameraNudgeDegrees: number;
      objectLiftPx: number;
      sealGlowPx: number;
    }
  | {
      kind: "packetOpen";
      label: "packet-open";
      tearProgress: number;
      sealScale: number;
      cameraShakePx: number;
      waxShardOpacity: number;
    }
  | {
      kind: "packetPreserve";
      label: "packet-preserve";
      pulseProgress: number;
      sealScale: number;
      humDuckDb: number;
    };

/**
 * Per-frame envelope for the packet-confirm interaction. The renderer holds
 * the `kind` (from `resolveAftersignPacketConfirmInteraction`) and the beat's
 * start time; on each frame it calls this with `elapsedMs = nowMs - startedAtMs`
 * and applies the returned envelope directly to camera/mesh/audio.
 *
 * Math:
 *   • settle (inspect, preserve): cubic ease-out — `1 - (1 - t)^3`.
 *   • seal glow (inspect): triangular window peaking at `sealGlowPeakMs`,
 *     zero before 0 and after `2 * sealGlowPeakMs`.
 *   • tear (open): linear ramp until `tearMs`, then cubic ease-out recoil.
 *   • preserve pulse: half-sine, one crest over `sealPulseMs`.
 *   • `reducedMotion` gates all camera / scale motion to the acceptance
 *     floor (zero shake/nudge, unit scale) — audio and progress values are
 *     preserved so the beat still lands on time.
 */
export function sampleAftersignInteractionConfirmEnvelope(
  kind: AftersignInteractionConfirmKind,
  elapsedMs: number,
  reducedMotion = false,
): AftersignInteractionConfirmEnvelope {
  if (!Number.isFinite(elapsedMs)) {
    throw new Error(
      "sampleAftersignInteractionConfirmEnvelope: elapsedMs must be finite",
    );
  }
  const clampedMs = Math.max(0, elapsedMs);

  if (kind === "packetOpen") {
    const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetOpen;
    const tearProgress = Math.min(1, clampedMs / feel.tearMs);
    const recoilProgress = Math.min(
      1,
      Math.max(0, clampedMs - feel.tearMs) / feel.recoilMs,
    );
    const recoilEase = 1 - Math.pow(1 - recoilProgress, 3);

    return {
      kind: "packetOpen",
      label: feel.label,
      tearProgress,
      sealScale: 1 + (feel.sealSnapScale - 1) * (1 - tearProgress),
      cameraShakePx: reducedMotion
        ? feel.acceptance.reducedMotionCameraShakePx
        : feel.cameraShakePx * (1 - recoilEase),
      waxShardOpacity: Math.max(0, 1 - clampedMs / feel.waxShardLifeMs),
    };
  }

  if (kind === "packetPreserve") {
    const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve;
    const pulseProgress = Math.min(1, clampedMs / feel.sealPulseMs);
    const pulse = Math.sin(pulseProgress * Math.PI);

    return {
      kind: "packetPreserve",
      label: feel.label,
      pulseProgress,
      sealScale: reducedMotion
        ? feel.acceptance.reducedMotionSealPulseScale
        : 1 + (feel.sealPulseScale - 1) * pulse,
      humDuckDb: feel.signHumDuckDb * (1 - pulseProgress),
    };
  }

  const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetInspect;
  const settleProgress = Math.min(1, clampedMs / feel.settleMs);
  const settleEase = 1 - Math.pow(1 - settleProgress, 3);
  const glowFalloff = Math.max(
    0,
    1 - Math.abs(clampedMs - feel.sealGlowPeakMs) / feel.sealGlowPeakMs,
  );

  return {
    kind: "packetInspect",
    label: feel.label,
    settleProgress,
    cameraNudgeDegrees: reducedMotion
      ? feel.acceptance.reducedMotionCameraNudgeDegrees
      : feel.cameraNudgeDegrees * (1 - settleEase),
    objectLiftPx: feel.objectLiftPx * (1 - settleEase),
    sealGlowPx: feel.sealGlowPx * glowFalloff,
  };
}
