export const AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL = {
  durationMs: 180,
  pressMs: 54,
  liftMs: 126,
  pressScale: 0.94,
  liftPx: 5,
  shakePx: 2,
  glowPeakOpacity: 0.72,
  glowPeakMs: 90,
  easing: "cubic-bezier(.2,.8,.2,1)",
  audio: {
    clickHz: 880,
    clickMs: 36,
    chimeHz: 1320,
    chimeDelayMs: 72,
  },
} as const;

export type AftersignPacketChoiceConfirmFeel = typeof AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL;

export function sampleAftersignPacketChoiceConfirmFeel(elapsedMs: number) {
  const clampedMs = Math.max(0, Math.min(AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.durationMs, elapsedMs));
  const k = clampedMs / AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.durationMs;
  const pressK = Math.min(1, clampedMs / AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.pressMs);
  const releaseK = Math.max(0, (clampedMs - AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.pressMs) / AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.liftMs);
  const shakePhase = Math.sin(k * Math.PI * 6);
  const shakeFade = 1 - k;
  const glowDistance = Math.abs(clampedMs - AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.glowPeakMs) / AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.glowPeakMs;

  return {
    scale:
      clampedMs <= AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.pressMs
        ? 1 - (1 - AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.pressScale) * pressK
        : AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.pressScale + (1 - AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.pressScale) * releaseK,
    liftPx: AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.liftPx * releaseK,
    shakeX: AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.shakePx * shakePhase * shakeFade,
    glowOpacity: AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.glowPeakOpacity * Math.max(0, 1 - glowDistance),
    complete: clampedMs === AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL.durationMs,
  };
}
