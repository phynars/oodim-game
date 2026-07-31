export type InteractionConfirmPhase = "press" | "settle" | "idle";

export interface InteractionConfirmSample {
  phase: InteractionConfirmPhase;
  elapsedMs: number;
  scale: number;
  emissiveBoost: number;
  shakePx: number;
  clickGain: number;
}

export interface InteractionConfirmOptions {
  elapsedMs: number;
  reducedMotion?: boolean;
}

export const INTERACTION_CONFIRM_FEEL = {
  pressMs: 80,
  settleMs: 160,
  pressScale: 0.94,
  overshootScale: 1.035,
  shakePx: 1.5,
  emissiveBoost: 0.32,
  clickGain: 0.18,
} as const;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function easeOutCubic(t: number): number {
  const inv = 1 - clamp01(t);
  return 1 - inv * inv * inv;
}

function easeInOutQuad(t: number): number {
  const k = clamp01(t);
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

export function sampleInteractionConfirm(options: InteractionConfirmOptions): InteractionConfirmSample {
  const elapsedMs = Math.max(0, options.elapsedMs);

  if (options.reducedMotion) {
    return {
      phase: elapsedMs < INTERACTION_CONFIRM_FEEL.pressMs ? "press" : "idle",
      elapsedMs,
      scale: 1,
      emissiveBoost: elapsedMs < INTERACTION_CONFIRM_FEEL.pressMs ? INTERACTION_CONFIRM_FEEL.emissiveBoost : 0,
      shakePx: 0,
      clickGain: elapsedMs === 0 ? INTERACTION_CONFIRM_FEEL.clickGain : 0,
    };
  }

  if (elapsedMs < INTERACTION_CONFIRM_FEEL.pressMs) {
    const k = easeOutCubic(elapsedMs / INTERACTION_CONFIRM_FEEL.pressMs);
    return {
      phase: "press",
      elapsedMs,
      scale: 1 + (INTERACTION_CONFIRM_FEEL.pressScale - 1) * k,
      emissiveBoost: INTERACTION_CONFIRM_FEEL.emissiveBoost * (1 - k * 0.35),
      shakePx: INTERACTION_CONFIRM_FEEL.shakePx * (1 - k),
      clickGain: elapsedMs === 0 ? INTERACTION_CONFIRM_FEEL.clickGain : 0,
    };
  }

  const settleElapsed = elapsedMs - INTERACTION_CONFIRM_FEEL.pressMs;
  if (settleElapsed < INTERACTION_CONFIRM_FEEL.settleMs) {
    const k = easeInOutQuad(settleElapsed / INTERACTION_CONFIRM_FEEL.settleMs);
    const overshoot = Math.sin(k * Math.PI) * (INTERACTION_CONFIRM_FEEL.overshootScale - 1);
    return {
      phase: "settle",
      elapsedMs,
      scale: INTERACTION_CONFIRM_FEEL.pressScale + (1 - INTERACTION_CONFIRM_FEEL.pressScale) * k + overshoot,
      emissiveBoost: INTERACTION_CONFIRM_FEEL.emissiveBoost * (1 - k),
      shakePx: 0,
      clickGain: 0,
    };
  }

  return {
    phase: "idle",
    elapsedMs,
    scale: 1,
    emissiveBoost: 0,
    shakePx: 0,
    clickGain: 0,
  };
}
