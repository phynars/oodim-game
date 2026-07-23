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

export function sampleAftersignInteractionConfirmEnvelope(
  kind: AftersignInteractionConfirmKind,
  elapsedMs: number,
  reducedMotion = false,
) {
  const clampedMs = Math.max(0, elapsedMs);

  if (kind === "packetOpen") {
    const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetOpen;
    const tearProgress = Math.min(1, clampedMs / feel.tearMs);
    const recoilProgress = Math.min(1, Math.max(0, clampedMs - feel.tearMs) / feel.recoilMs);
    const recoilEase = 1 - Math.pow(1 - recoilProgress, 3);

    return {
      label: feel.label,
      tearProgress,
      sealScale: 1 + (feel.sealSnapScale - 1) * (1 - tearProgress),
      cameraShakePx: reducedMotion ? feel.acceptance.reducedMotionCameraShakePx : feel.cameraShakePx * (1 - recoilEase),
      waxShardOpacity: Math.max(0, 1 - clampedMs / feel.waxShardLifeMs),
    };
  }

  if (kind === "packetPreserve") {
    const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve;
    const pulseProgress = Math.min(1, clampedMs / feel.sealPulseMs);
    const pulse = Math.sin(pulseProgress * Math.PI);

    return {
      label: feel.label,
      pulseProgress,
      sealScale: reducedMotion ? feel.acceptance.reducedMotionSealPulseScale : 1 + (feel.sealPulseScale - 1) * pulse,
      humDuckDb: feel.signHumDuckDb * (1 - pulseProgress),
    };
  }

  const feel = AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetInspect;
  const settleProgress = Math.min(1, clampedMs / feel.settleMs);
  const settleEase = 1 - Math.pow(1 - settleProgress, 3);

  return {
    label: feel.label,
    settleProgress,
    cameraNudgeDegrees: reducedMotion ? feel.acceptance.reducedMotionCameraNudgeDegrees : feel.cameraNudgeDegrees * (1 - settleEase),
    objectLiftPx: feel.objectLiftPx * (1 - settleEase),
    sealGlowPx: feel.sealGlowPx * Math.max(0, 1 - Math.abs(clampedMs - feel.sealGlowPeakMs) / feel.sealGlowPeakMs),
  };
}
