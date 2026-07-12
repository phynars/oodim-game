// AFTERSIGN — Io phone-ready recognition feel contract for the flagship slice.
//
// Pure-data timing envelope for the first mobile recognition beat. Runtime and
// e2e code can sample this instead of duplicating feel numbers in assertions.

export type IoPhoneReadyFeelSample = {
  elapsedMs: number;
  progress: number;
  settleProgress: number;
  lineTranslateYPx: number;
  lineOpacity: number;
  glowOpacity: number;
  audioGain: number;
  visualCueMs: number;
  audioCueMs: number;
  audioVisualDriftMs: number;
};

export const IO_PHONE_READY_FEEL = {
  settleMs: 360,
  lineRisePx: 14,
  glowPeakOpacity: 0.34,
  visualCueMs: 96,
  audioCueMs: 112,
  maxAudioVisualDriftMs: 50,
  easing: "cubic-bezier(.16,1,.3,1)",
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const easeOutCubic = (value: number): number => {
  const inverse = 1 - clamp01(value);
  return 1 - inverse * inverse * inverse;
};

export function sampleIoPhoneReadyFeel(elapsedMs: number): IoPhoneReadyFeelSample {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const settleProgress = clamp01(safeElapsedMs / IO_PHONE_READY_FEEL.settleMs);
  const eased = easeOutCubic(settleProgress);
  const glowFalloff = 1 - Math.abs(settleProgress * 2 - 1);
  const audioVisualDriftMs = Math.abs(
    IO_PHONE_READY_FEEL.audioCueMs - IO_PHONE_READY_FEEL.visualCueMs,
  );

  return {
    elapsedMs: safeElapsedMs,
    progress: settleProgress,
    settleProgress: eased,
    lineTranslateYPx: IO_PHONE_READY_FEEL.lineRisePx * (1 - eased),
    lineOpacity: eased,
    glowOpacity: IO_PHONE_READY_FEEL.glowPeakOpacity * clamp01(glowFalloff),
    audioGain: safeElapsedMs >= IO_PHONE_READY_FEEL.audioCueMs && safeElapsedMs <= IO_PHONE_READY_FEEL.audioCueMs + 80 ? 0.72 : 0,
    visualCueMs: IO_PHONE_READY_FEEL.visualCueMs,
    audioCueMs: IO_PHONE_READY_FEEL.audioCueMs,
    audioVisualDriftMs,
  };
}
