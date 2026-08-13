export const DEFAULT_FAILURE_STING_FEEL = Object.freeze({
  durationMs: 180,
  cameraKickWorldX: 0.038,
  cameraYawDegrees: 0.9,
  hudShakePx: 8,
  hudDropPx: 2,
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
  return 1 - (1 - t) * (1 - t);
}

function dampedSine(progress, cycles) {
  const envelope = 1 - easeOutQuad(progress);
  return Math.sin(progress * Math.PI * 2 * cycles) * envelope;
}

export function failureStingEnvelopeAt(elapsedMs, feel = DEFAULT_FAILURE_STING_FEEL) {
  const durationMs = Math.max(1, feel.durationMs ?? DEFAULT_FAILURE_STING_FEEL.durationMs);
  const progress = clamp01(elapsedMs / durationMs);
  const kick = 1 - easeOutQuad(progress);
  const wobble = dampedSine(progress, feel.wobbleCycles ?? DEFAULT_FAILURE_STING_FEEL.wobbleCycles);
  const shake = wobble === 0 ? kick : wobble;

  return {
    active: progress < 1,
    progress,
    cameraKickWorldX: (feel.cameraKickWorldX ?? DEFAULT_FAILURE_STING_FEEL.cameraKickWorldX) * kick,
    cameraYawDegrees: (feel.cameraYawDegrees ?? DEFAULT_FAILURE_STING_FEEL.cameraYawDegrees) * wobble,
    hudShakeX: (feel.hudShakePx ?? DEFAULT_FAILURE_STING_FEEL.hudShakePx) * shake,
    hudDropY: (feel.hudDropPx ?? DEFAULT_FAILURE_STING_FEEL.hudDropPx) * kick,
    flashAlpha: (feel.flashAlpha ?? DEFAULT_FAILURE_STING_FEEL.flashAlpha) * kick,
    vignetteAlpha: (feel.vignetteAlpha ?? DEFAULT_FAILURE_STING_FEEL.vignetteAlpha) * kick,
    recoveryScale: 1 - (1 - (feel.recoveryScale ?? DEFAULT_FAILURE_STING_FEEL.recoveryScale)) * kick,
  };
}
