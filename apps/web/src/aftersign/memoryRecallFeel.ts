// AFTERSIGN — memory-recall feel contract for the flagship slice.
//
// Pure-data timing envelope for the first moment an NPC visibly remembers the
// player across sessions. Runtime code can sample this for camera/audio/UI
// choreography, and the harness can assert the numbers without DOM/WebGL.

export type MemoryRecallFeelSample = {
  elapsedMs: number;
  progress: number;
  lockProgress: number;
  cameraPushInPx: number;
  cameraYawDeg: number;
  nameplateLiftPx: number;
  nameplateOpacity: number;
  recognitionGlowAlpha: number;
  screenVignetteAlpha: number;
  memoryChimeGain: number;
  visualCueMs: number;
  audioCueMs: number;
  audioVisualDriftMs: number;
};

export const MEMORY_RECALL_FEEL = {
  durationMs: 520,
  lockMs: 180,
  cameraPushInPxPeak: 18,
  cameraYawDegPeak: 0.7,
  nameplateLiftPx: 10,
  glowAlphaPeak: 0.46,
  vignetteAlphaPeak: 0.18,
  visualCueMs: 72,
  audioCueMs: 88,
  audioGainPeak: 0.66,
  audioGateMs: 96,
  maxAudioVisualDriftMs: 50,
  easing: "cubic-bezier(.16,1,.3,1)",
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const easeOutCubic = (value: number): number => {
  const inverse = 1 - clamp01(value);
  return 1 - inverse * inverse * inverse;
};

const easeInOutSine = (value: number): number => {
  const t = clamp01(value);
  return -(Math.cos(Math.PI * t) - 1) / 2;
};

export function sampleMemoryRecallFeel(elapsedMs: number): MemoryRecallFeelSample {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp01(safeElapsedMs / MEMORY_RECALL_FEEL.durationMs);
  const lockProgress = easeOutCubic(safeElapsedMs / MEMORY_RECALL_FEEL.lockMs);
  const settle = easeOutCubic(progress);
  const pulse = Math.sin(progress * Math.PI);
  const tail = 1 - easeInOutSine(progress);
  const audioVisualDriftMs = Math.abs(
    MEMORY_RECALL_FEEL.audioCueMs - MEMORY_RECALL_FEEL.visualCueMs,
  );
  const audioWindowOpen = safeElapsedMs >= MEMORY_RECALL_FEEL.audioCueMs;
  const audioWindowClosed =
    safeElapsedMs > MEMORY_RECALL_FEEL.audioCueMs + MEMORY_RECALL_FEEL.audioGateMs;

  return {
    elapsedMs: safeElapsedMs,
    progress,
    lockProgress,
    cameraPushInPx: MEMORY_RECALL_FEEL.cameraPushInPxPeak * lockProgress * tail,
    cameraYawDeg: MEMORY_RECALL_FEEL.cameraYawDegPeak * pulse * tail,
    nameplateLiftPx: MEMORY_RECALL_FEEL.nameplateLiftPx * (1 - settle),
    nameplateOpacity: settle,
    recognitionGlowAlpha: MEMORY_RECALL_FEEL.glowAlphaPeak * pulse,
    screenVignetteAlpha: MEMORY_RECALL_FEEL.vignetteAlphaPeak * lockProgress * tail,
    memoryChimeGain: audioWindowOpen && !audioWindowClosed ? MEMORY_RECALL_FEEL.audioGainPeak : 0,
    visualCueMs: MEMORY_RECALL_FEEL.visualCueMs,
    audioCueMs: MEMORY_RECALL_FEEL.audioCueMs,
    audioVisualDriftMs,
  };
}
