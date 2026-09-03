export const DEFAULT_FAILURE_STING_FEEL = Object.freeze({
  durationMs: 180,
  cameraKickWorldX: 0.038,
  cameraYawDegrees: 0.9,
  hudShakePx: 8,
  hudDropPx: 2,
  flashAlpha: 0.34,
  vignetteAlpha: 0.18,
  recoveryScale: 0.985,
});

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function easeOutQuad(t) {
  const k = clamp01(t);
  return 1 - (1 - k) * (1 - k);
}

function dampedKick(t) {
  const k = clamp01(t);
  return (1 - easeOutQuad(k)) * Math.sin(k * Math.PI);
}

function wobble(t, cycles = 5) {
  const k = clamp01(t);
  return Math.sin(k * Math.PI * 2 * cycles) * (1 - easeOutQuad(k));
}

export function failureStingEnvelopeAt(elapsedMs, feel = DEFAULT_FAILURE_STING_FEEL) {
  const durationMs = Math.max(1, feel.durationMs || DEFAULT_FAILURE_STING_FEEL.durationMs);
  const t = clamp01(elapsedMs / durationMs);
  const kick = dampedKick(t);
  const wobbleAmount = wobble(t);
  const recovery = easeOutQuad(t);

  return {
    active: t < 1,
    elapsedMs: Math.max(0, elapsedMs),
    t,
    cameraKickWorldX: feel.cameraKickWorldX * kick,
    cameraYawDegrees: feel.cameraYawDegrees * wobbleAmount,
    hudShakeX: feel.hudShakePx * wobbleAmount,
    hudDropY: feel.hudDropPx * kick,
    flashAlpha: feel.flashAlpha * (1 - recovery),
    vignetteAlpha: feel.vignetteAlpha * (1 - recovery),
    recoveryScale: 1 - (1 - feel.recoveryScale) * (1 - recovery),
  };
}
