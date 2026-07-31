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
    // Normalized time through the settle window.
    const t = settleElapsed / INTERACTION_CONFIRM_FEEL.settleMs;
    // Front-load the recovery: the base scale sprints from pressScale back to 1
    // in the first half of the settle window (t=0..0.5), then holds at 1.
    // This decouples the "return to rest" from the "overshoot pop", so the
    // sin() bump actually peaks above 1 instead of getting swallowed by a
    // mid-lerp base still climbing out of press.
    const recover = easeOutCubic(Math.min(1, t * 2));
    const base = INTERACTION_CONFIRM_FEEL.pressScale + (1 - INTERACTION_CONFIRM_FEEL.pressScale) * recover;
    // Overshoot bump peaks at t=0.5 (exactly when base has just reached 1),
    // so peak visual scale = 1 + (overshootScale - 1) = overshootScale.
    const overshoot = Math.sin(t * Math.PI) * (INTERACTION_CONFIRM_FEEL.overshootScale - 1);
    // Emissive glow eases out over the full settle window.
    const emissiveK = easeInOutQuad(t);
    return {
      phase: "settle",
      elapsedMs,
      scale: base + overshoot,
      emissiveBoost: INTERACTION_CONFIRM_FEEL.emissiveBoost * (1 - emissiveK),
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
