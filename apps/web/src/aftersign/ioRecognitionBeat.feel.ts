export type AftersignIoRecognitionOutcome = "sealed" | "opened";

export type AftersignIoRecognitionPhase =
  | "preRecognitionHold"
  | "cameraPush"
  | "lineDelivery"
  | "afterglow";

export interface AftersignIoRecognitionFeelFrame {
  phase: AftersignIoRecognitionPhase;
  elapsedMs: number;
  cameraPushDegrees: number;
  cameraLiftPx: number;
  signGlowIntensity: number;
  vignetteAlpha: number;
  bellGainDb: number;
  subtitleAlpha: number;
}

export interface AftersignIoRecognitionFeelContract {
  totalMs: number;
  preRecognitionHoldMs: number;
  cameraPushMs: number;
  lineDeliveryMs: number;
  afterglowMs: number;
  cameraPushDegrees: number;
  cameraLiftPx: number;
  signGlowPeak: number;
  vignettePeakAlpha: number;
  bellStingStartMs: number;
  bellStingPeakDb: number;
  subtitleFadeMs: number;
  easing: {
    cameraPush: "easeOutCubic";
    signGlowAttack: "easeOutCubic";
    afterglowDecay: "easeInQuad";
  };
  outcomeTint: Record<AftersignIoRecognitionOutcome, string>;
}

export const AFTERSIGN_IO_RECOGNITION_BEAT_FEEL: AftersignIoRecognitionFeelContract = {
  totalMs: 1680,
  preRecognitionHoldMs: 180,
  cameraPushMs: 520,
  lineDeliveryMs: 720,
  afterglowMs: 260,
  cameraPushDegrees: 2.4,
  cameraLiftPx: 10,
  signGlowPeak: 1.35,
  vignettePeakAlpha: 0.18,
  bellStingStartMs: 140,
  bellStingPeakDb: -9,
  subtitleFadeMs: 120,
  easing: {
    cameraPush: "easeOutCubic",
    signGlowAttack: "easeOutCubic",
    afterglowDecay: "easeInQuad",
  },
  outcomeTint: {
    sealed: "#f6c86a",
    opened: "#b44b4b",
  },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInQuad = (t: number) => clamp01(t) * clamp01(t);

export function sampleAftersignIoRecognitionBeat(
  elapsedMs: number,
  feel: AftersignIoRecognitionFeelContract = AFTERSIGN_IO_RECOGNITION_BEAT_FEEL,
): AftersignIoRecognitionFeelFrame {
  const t = Math.max(0, elapsedMs);
  const pushStart = feel.preRecognitionHoldMs;
  const lineStart = pushStart + feel.cameraPushMs;
  const afterglowStart = lineStart + feel.lineDeliveryMs;
  const end = feel.totalMs;

  const pushK = easeOutCubic((t - pushStart) / feel.cameraPushMs);
  const lineK = clamp01((t - lineStart) / feel.subtitleFadeMs);
  const afterglowK = easeInQuad((t - afterglowStart) / feel.afterglowMs);
  const glowAttackK = easeOutCubic(t / (feel.preRecognitionHoldMs + feel.cameraPushMs));
  const glowDecay = 1 - afterglowK;
  const bellK = Math.max(0, 1 - Math.abs(t - feel.bellStingStartMs) / 220);

  let phase: AftersignIoRecognitionPhase = "preRecognitionHold";
  if (t >= afterglowStart) {
    phase = "afterglow";
  } else if (t >= lineStart) {
    phase = "lineDelivery";
  } else if (t >= pushStart) {
    phase = "cameraPush";
  }

  return {
    phase,
    elapsedMs: Math.min(t, end),
    cameraPushDegrees: feel.cameraPushDegrees * pushK,
    cameraLiftPx: feel.cameraLiftPx * pushK,
    signGlowIntensity: feel.signGlowPeak * glowAttackK * glowDecay,
    vignetteAlpha: feel.vignettePeakAlpha * pushK * glowDecay,
    bellGainDb: feel.bellStingPeakDb - 18 * (1 - clamp01(bellK)),
    subtitleAlpha: lineK * glowDecay,
  };
}
