// AFTERSIGN — failure-sting feel contract for the flagship slice.
//
// Pure-data envelope for a failed interaction: the tiny recoil, desaturated
// flash, and muted thud that says "not yet" without feeling like a bug.

export type FailureStingSample = {
  elapsedMs: number;
  progress: number;
  recoilPx: number;
  shakePx: number;
  vignetteAlpha: number;
  desaturate: number;
  thudGain: number;
};

export const FAILURE_STING_FEEL = {
  durationMs: 240,
  recoilPeakMs: 64,
  recoilPxPeak: -5,
  shakePxPeak: 1.8,
  vignetteAlphaPeak: 0.46,
  desaturatePeak: 0.32,
  thudGainPeak: 0.68,
  easing: "cubic-bezier(.16,1,.3,1)",
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const easeOutCubic = (value: number): number => {
  const inverse = 1 - clamp01(value);
  return 1 - inverse * inverse * inverse;
};

const easeInQuad = (value: number): number => {
  const t = clamp01(value);
  return t * t;
};

export function sampleFailureStingFeel(elapsedMs: number): FailureStingSample {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp01(safeElapsedMs / FAILURE_STING_FEEL.durationMs);
  const recoilProgress = clamp01(safeElapsedMs / FAILURE_STING_FEEL.recoilPeakMs);
  const recoveryProgress = clamp01(
    (safeElapsedMs - FAILURE_STING_FEEL.recoilPeakMs) /
      (FAILURE_STING_FEEL.durationMs - FAILURE_STING_FEEL.recoilPeakMs),
  );

  const recoilIn = easeOutCubic(recoilProgress);
  const recovery = easeOutCubic(recoveryProgress);
  const hold = 1 - recovery;
  const tail = 1 - easeInQuad(progress);

  return {
    elapsedMs: safeElapsedMs,
    progress,
    recoilPx: FAILURE_STING_FEEL.recoilPxPeak * recoilIn * hold,
    shakePx: FAILURE_STING_FEEL.shakePxPeak * Math.sin(progress * Math.PI * 8) * tail,
    vignetteAlpha: FAILURE_STING_FEEL.vignetteAlphaPeak * recoilIn * tail,
    desaturate: FAILURE_STING_FEEL.desaturatePeak * recoilIn * tail,
    thudGain: safeElapsedMs <= 32 ? FAILURE_STING_FEEL.thudGainPeak : 0,
  };
}
