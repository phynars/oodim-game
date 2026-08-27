export type IoJobOfferSelectFeelPhase = "idle" | "press" | "commit" | "settle";

export interface IoJobOfferSelectFeelEnvelope {
  readonly phase: IoJobOfferSelectFeelPhase;
  readonly elapsedMs: number;
  readonly liftPx: number;
  readonly scale: number;
  readonly glowAlpha: number;
  readonly ringAlpha: number;
  readonly hudNudgePx: number;
  readonly audioGain: number;
}

export interface IoJobOfferSelectFeelSpec {
  readonly pressMs: number;
  readonly commitMs: number;
  readonly settleMs: number;
  readonly maxLiftPx: number;
  readonly maxScale: number;
  readonly maxGlowAlpha: number;
  readonly maxRingAlpha: number;
  readonly maxHudNudgePx: number;
  readonly maxAudioGain: number;
}

export const IO_JOB_OFFER_SELECT_FEEL: IoJobOfferSelectFeelSpec = {
  pressMs: 84,
  commitMs: 156,
  settleMs: 280,
  maxLiftPx: 7,
  maxScale: 1.028,
  maxGlowAlpha: 0.32,
  maxRingAlpha: 0.44,
  maxHudNudgePx: 4,
  maxAudioGain: 0.22,
};

export function resolveIoJobOfferSelectFeel(
  elapsedMs: number,
  spec: IoJobOfferSelectFeelSpec = IO_JOB_OFFER_SELECT_FEEL,
): IoJobOfferSelectFeelEnvelope {
  const elapsed = Math.max(0, elapsedMs);
  const commitEnd = spec.pressMs + spec.commitMs;
  const settleEnd = commitEnd + spec.settleMs;

  if (elapsed <= spec.pressMs) {
    const t = easeOutCubic(elapsed / spec.pressMs);
    return {
      phase: "press",
      elapsedMs: elapsed,
      liftPx: -spec.maxLiftPx * 0.35 * t,
      scale: lerp(1, 0.982, t),
      glowAlpha: spec.maxGlowAlpha * 0.45 * t,
      ringAlpha: spec.maxRingAlpha * 0.25 * t,
      hudNudgePx: spec.maxHudNudgePx * 0.4 * t,
      audioGain: spec.maxAudioGain * 0.55 * t,
    };
  }

  if (elapsed <= commitEnd) {
    const t = easeOutBack((elapsed - spec.pressMs) / spec.commitMs);
    return {
      phase: "commit",
      elapsedMs: elapsed,
      liftPx: -spec.maxLiftPx * t,
      scale: lerp(0.982, spec.maxScale, t),
      glowAlpha: spec.maxGlowAlpha * t,
      ringAlpha: spec.maxRingAlpha * t,
      hudNudgePx: spec.maxHudNudgePx * t,
      // Intentional: `audioGain` peaks MID-COMMIT (triangle in `t`,
      // apex at t=0.5) rather than climbing monotonically like the
      // visual fields. The confirm chirp is a struck-bell impulse —
      // it swells INTO the commit peak and decays out with the
      // easeOutBack overshoot, so the ear hears one round hit
      // instead of a step at phase-end. Visual and audio share the
      // same peak instant (t=0.5 lines up with the easeOutBack
      // apex on the visual fields) but different curves: the ear
      // wants a triangle, the eye wants a settle.
      audioGain: spec.maxAudioGain * (1 - Math.abs(0.5 - t)),
    };
  }

  if (elapsed <= settleEnd) {
    const t = easeOutQuad((elapsed - commitEnd) / spec.settleMs);
    return {
      phase: "settle",
      elapsedMs: elapsed,
      liftPx: -spec.maxLiftPx * (1 - t),
      scale: lerp(spec.maxScale, 1, t),
      glowAlpha: spec.maxGlowAlpha * (1 - t),
      ringAlpha: spec.maxRingAlpha * (1 - t),
      hudNudgePx: spec.maxHudNudgePx * (1 - t),
      audioGain: spec.maxAudioGain * 0.28 * (1 - t),
    };
  }

  return {
    phase: "idle",
    elapsedMs: elapsed,
    liftPx: 0,
    scale: 1,
    glowAlpha: 0,
    ringAlpha: 0,
    hudNudgePx: 0,
    audioGain: 0,
  };
}

function easeOutQuad(value: number): number {
  const t = clamp01(value);
  return 1 - (1 - t) * (1 - t);
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(value: number): number {
  const t = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
