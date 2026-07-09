export type InteractionConfirmKind = "soft" | "decisive" | "rejected";

export interface InteractionConfirmCue {
  kind: InteractionConfirmKind;
  durationMs: number;
  pressScale: number;
  releaseScale: number;
  liftPx: number;
  shakePx: number;
  bloomBoost: number;
  audioGain: number;
  hapticMs: number;
  easing: "cubic-bezier(.2,.8,.2,1)" | "cubic-bezier(.34,1.56,.64,1)" | "steps(1,end)";
}

const CONFIRM_CUES: Record<InteractionConfirmKind, InteractionConfirmCue> = {
  soft: {
    kind: "soft",
    durationMs: 140,
    pressScale: 0.985,
    releaseScale: 1.015,
    liftPx: 2,
    shakePx: 0,
    bloomBoost: 0.04,
    audioGain: 0.35,
    hapticMs: 8,
    easing: "cubic-bezier(.2,.8,.2,1)",
  },
  decisive: {
    kind: "decisive",
    durationMs: 180,
    pressScale: 0.97,
    releaseScale: 1.04,
    liftPx: 4,
    shakePx: 1.5,
    bloomBoost: 0.12,
    audioGain: 0.7,
    hapticMs: 16,
    easing: "cubic-bezier(.34,1.56,.64,1)",
  },
  rejected: {
    kind: "rejected",
    durationMs: 96,
    pressScale: 0.99,
    releaseScale: 1,
    liftPx: 0,
    shakePx: 2.5,
    bloomBoost: 0,
    audioGain: 0.22,
    hapticMs: 24,
    easing: "steps(1,end)",
  },
};

export function getInteractionConfirmCue(kind: InteractionConfirmKind): InteractionConfirmCue {
  return CONFIRM_CUES[kind];
}

export function sampleInteractionConfirmCue(kind: InteractionConfirmKind, elapsedMs: number) {
  const cue = getInteractionConfirmCue(kind);
  const progress = Math.min(Math.max(elapsedMs / cue.durationMs, 0), 1);
  const release = 1 - Math.pow(1 - progress, 3);
  const scale = progress < 0.18
    ? 1 + (cue.pressScale - 1) * (progress / 0.18)
    : cue.pressScale + (cue.releaseScale - cue.pressScale) * release;

  return {
    progress,
    scale,
    liftPx: cue.liftPx * release,
    shakePx: cue.shakePx * (1 - progress),
    bloomBoost: cue.bloomBoost * (1 - Math.pow(progress, 2)),
    audioGain: elapsedMs === 0 ? cue.audioGain : 0,
    hapticMs: elapsedMs === 0 ? cue.hapticMs : 0,
  };
}
