import {
  AFTERSIGN_MEMORY_RECALL_GLINT_FEEL,
  resolveAftersignMemoryRecallGlintEnvelope,
  type AftersignMemoryRecallGlintEnvelope,
} from "./memoryRecallGlintFeel";

export type MemoryRecallPhase = "dormant" | "recognize" | "settle" | "held";

export interface MemoryRecallFeelFrame {
  phase: MemoryRecallPhase;
  elapsedMs: number;
  progress: number;
  captionOpacity: number;
  captionLiftPx: number;
  haloOpacity: number;
  haloScale: number;
  cameraYawDeg: number;
  bloomGain: number;
  audioGain: number;
  hapticMs: number;
  /**
   * Specular-shimmer sub-envelope composited on top of the base beat.
   * Aligned to `MEMORY_RECALL_FEEL.durationMs` / `.cameraYawDeg` via
   * `AFTERSIGN_MEMORY_RECALL_GLINT_FEEL` so there is ONE source of
   * truth for the recall beat's core numbers. Consumers (renderer /
   * `window.__game.recallFeel`) read `frame.glint` to composite the
   * shimmer pass; reduced-motion callers can ignore it or crossfade
   * against `frame.progress` at their discretion.
   */
  glint: AftersignMemoryRecallGlintEnvelope;
}

export interface MemoryRecallFeelOptions {
  elapsedMs: number;
  reducedMotion?: boolean;
}

export const MEMORY_RECALL_FEEL = {
  durationMs: 760,
  recognizeMs: 220,
  settleMs: 320,
  holdMs: 220,
  captionLiftPx: 14,
  haloScalePeak: 1.18,
  cameraYawDeg: 1.6,
  bloomGainPeak: 0.34,
  audioGainPeak: 0.42,
  hapticMs: 12,
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

export function getMemoryRecallFeel({
  elapsedMs,
  reducedMotion = false,
}: MemoryRecallFeelOptions): MemoryRecallFeelFrame {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp01(safeElapsedMs / MEMORY_RECALL_FEEL.durationMs);
  const recognizeEnd = MEMORY_RECALL_FEEL.recognizeMs;
  const settleEnd = recognizeEnd + MEMORY_RECALL_FEEL.settleMs;

  if (safeElapsedMs <= 0) {
    return {
      phase: "dormant",
      elapsedMs: safeElapsedMs,
      progress: 0,
      captionOpacity: 0,
      captionLiftPx: 0,
      haloOpacity: 0,
      haloScale: 1,
      cameraYawDeg: 0,
      bloomGain: 0,
      audioGain: 0,
      hapticMs: 0,
      glint: resolveAftersignMemoryRecallGlintEnvelope(
        0,
        AFTERSIGN_MEMORY_RECALL_GLINT_FEEL,
      ),
    };
  }

  const recognizeT = clamp01(safeElapsedMs / MEMORY_RECALL_FEEL.recognizeMs);
  const settleT = clamp01((safeElapsedMs - recognizeEnd) / MEMORY_RECALL_FEEL.settleMs);
  const holdT = clamp01((safeElapsedMs - settleEnd) / MEMORY_RECALL_FEEL.holdMs);
  const isSettling = safeElapsedMs > recognizeEnd && safeElapsedMs <= settleEnd;
  const isHeld = safeElapsedMs > settleEnd;

  const entrance = easeOutCubic(recognizeT);
  const settle = easeInOutSine(settleT);
  const holdFade = 1 - easeInOutSine(holdT);
  const motionScale = reducedMotion ? 0.35 : 1;

  return {
    phase: isHeld ? "held" : isSettling ? "settle" : "recognize",
    elapsedMs: safeElapsedMs,
    progress,
    captionOpacity: isHeld ? holdFade : entrance,
    captionLiftPx: MEMORY_RECALL_FEEL.captionLiftPx * entrance * holdFade * motionScale,
    haloOpacity: (isHeld ? 0.18 * holdFade : 0.52 * entrance * (1 - 0.45 * settle)),
    haloScale: 1 + (MEMORY_RECALL_FEEL.haloScalePeak - 1) * entrance * (1 - 0.7 * settle) * motionScale,
    cameraYawDeg: MEMORY_RECALL_FEEL.cameraYawDeg * Math.sin(Math.PI * progress) * motionScale,
    bloomGain: MEMORY_RECALL_FEEL.bloomGainPeak * entrance * (isHeld ? holdFade : 1 - 0.55 * settle),
    audioGain: MEMORY_RECALL_FEEL.audioGainPeak * entrance * (isHeld ? holdFade : 1),
    hapticMs: safeElapsedMs <= 16 && !reducedMotion ? MEMORY_RECALL_FEEL.hapticMs : 0,
    glint: resolveAftersignMemoryRecallGlintEnvelope(
      safeElapsedMs,
      AFTERSIGN_MEMORY_RECALL_GLINT_FEEL,
    ),
  };
}

export function sampleMemoryRecallFeel(stepMs = 40): MemoryRecallFeelFrame[] {
  const frames: MemoryRecallFeelFrame[] = [];
  for (let elapsedMs = 0; elapsedMs <= MEMORY_RECALL_FEEL.durationMs; elapsedMs += stepMs) {
    frames.push(getMemoryRecallFeel({ elapsedMs }));
  }
  if (frames[frames.length - 1]?.elapsedMs !== MEMORY_RECALL_FEEL.durationMs) {
    frames.push(getMemoryRecallFeel({ elapsedMs: MEMORY_RECALL_FEEL.durationMs }));
  }
  return frames;
}
