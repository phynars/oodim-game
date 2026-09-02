export const DEFAULT_FAILURE_STING_FEEL = Object.freeze({
  durationMs: 180,
  cameraKickWorldX: 0.038,
  cameraYawDegrees: 0.9,
  hudShakeX: 8,
  hudDropY: 2,
  flashAlpha: 0.34,
  vignetteAlpha: 0.18,
  recoveryScale: 0.985,
  wobbleCycles: 5,
});

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function easeOutQuad(t) {
  const p = clamp01(t);
  return 1 - (1 - p) * (1 - p);
}

function dampedWobble(t, cycles) {
  const p = clamp01(t);
  const decay = 1 - easeOutQuad(p);
  return Math.sin(p * Math.PI * 2 * cycles) * decay;
}

export function failureStingEnvelopeAt(elapsedMs, feel = DEFAULT_FAILURE_STING_FEEL) {
  const durationMs = Math.max(1, feel.durationMs ?? DEFAULT_FAILURE_STING_FEEL.durationMs);
  const progress = clamp01(elapsedMs / durationMs);
  const attack = 1 - easeOutQuad(progress);
  const wobble = dampedWobble(progress, feel.wobbleCycles ?? DEFAULT_FAILURE_STING_FEEL.wobbleCycles);

  return {
    active: progress < 1,
    progress,
    cameraKickWorldX: (feel.cameraKickWorldX ?? DEFAULT_FAILURE_STING_FEEL.cameraKickWorldX) * attack,
    cameraYawDegrees: (feel.cameraYawDegrees ?? DEFAULT_FAILURE_STING_FEEL.cameraYawDegrees) * wobble,
    hudShakeX: (feel.hudShakeX ?? DEFAULT_FAILURE_STING_FEEL.hudShakeX) * wobble,
    hudDropY: (feel.hudDropY ?? DEFAULT_FAILURE_STING_FEEL.hudDropY) * attack,
    flashAlpha: (feel.flashAlpha ?? DEFAULT_FAILURE_STING_FEEL.flashAlpha) * attack,
    vignetteAlpha: (feel.vignetteAlpha ?? DEFAULT_FAILURE_STING_FEEL.vignetteAlpha) * attack,
    recoveryScale: 1 - (1 - (feel.recoveryScale ?? DEFAULT_FAILURE_STING_FEEL.recoveryScale)) * attack,
  };
}
