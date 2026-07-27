export type AftersignIoRecognitionBeatFeel = {
  readonly cameraPushMs: number;
  readonly cameraPushDegrees: number;
  readonly cameraEase: "easeOutCubic";
  readonly signGlowDelayMs: number;
  readonly signGlowPeakMs: number;
  readonly signGlowFadeMs: number;
  readonly recognitionStingDelayMs: number;
  readonly recognitionStingMs: number;
  readonly lanternPulsePx: number;
  readonly screenSettlePx: number;
  readonly reducedMotionCameraPushDegrees: number;
  readonly reducedMotionScreenSettlePx: number;
};

export const AFTERSIGN_IO_RECOGNITION_BEAT_FEEL: AftersignIoRecognitionBeatFeel = {
  cameraPushMs: 420,
  cameraPushDegrees: 3.2,
  cameraEase: "easeOutCubic",
  signGlowDelayMs: 90,
  signGlowPeakMs: 180,
  signGlowFadeMs: 520,
  recognitionStingDelayMs: 120,
  recognitionStingMs: 680,
  lanternPulsePx: 6,
  screenSettlePx: 1.5,
  reducedMotionCameraPushDegrees: 0,
  reducedMotionScreenSettlePx: 0,
};

export function sampleAftersignIoRecognitionBeatFeel(
  elapsedMs: number,
  reducedMotion = false,
): {
  readonly cameraPushDegrees: number;
  readonly signGlow: number;
  readonly stingGain: number;
  readonly lanternPulsePx: number;
  readonly screenSettlePx: number;
} {
  const t = Math.max(0, elapsedMs);
  const cameraK = easeOutCubic(clamp01(t / AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.cameraPushMs));
  const glowT = Math.max(0, t - AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.signGlowDelayMs);
  const glowAttack = clamp01(glowT / AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.signGlowPeakMs);
  const glowFade = clamp01(
    (glowT - AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.signGlowPeakMs) /
      AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.signGlowFadeMs,
  );
  const signGlow = glowT <= AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.signGlowPeakMs
    ? easeOutCubic(glowAttack)
    : 1 - easeInQuad(glowFade);

  const stingT = Math.max(0, t - AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.recognitionStingDelayMs);
  const stingK = clamp01(stingT / AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.recognitionStingMs);
  const stingGain = stingT === 0 ? 0 : Math.max(0, Math.sin(stingK * Math.PI) * (1 - stingK * 0.35));

  return {
    cameraPushDegrees: reducedMotion
      ? AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.reducedMotionCameraPushDegrees
      : AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.cameraPushDegrees * cameraK,
    signGlow: clamp01(signGlow),
    stingGain,
    lanternPulsePx: AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.lanternPulsePx * signGlow,
    screenSettlePx: reducedMotion
      ? AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.reducedMotionScreenSettlePx
      : AFTERSIGN_IO_RECOGNITION_BEAT_FEEL.screenSettlePx * (1 - cameraK),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInQuad(value: number): number {
  return value * value;
}
