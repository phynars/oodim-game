export const DEFAULT_FAILURE_STING_FEEL = {
  durationMs: 180,
  easing: "easeOutQuad",
  cameraKickDeg: 0.9,
  cameraKickWorldX: 0.038,
  hudShakePx: 8,
  hudDropPx: 2,
  flashAlpha: 0.34,
  vignetteAlpha: 0.18,
  wobbleCycles: 5,
  recoveryScale: 0.985,
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const failureStingEnvelopeAt = (elapsedMs, feel = DEFAULT_FAILURE_STING_FEEL) => {
  const durationMs = Math.max(1, feel.durationMs);
  const progress = clamp01(elapsedMs / durationMs);
  const curve = 1 - ((1 - progress) ** 2);
  const falloff = 1 - curve;
  const wobble = falloff * Math.sin(progress * Math.PI * feel.wobbleCycles);
  const active = Number.isFinite(elapsedMs) && progress < 1;

  return {
    durationMs: feel.durationMs,
    easing: feel.easing,
    active,
    progress,
    remainingMs: active ? Math.max(0, Math.round(durationMs - elapsedMs)) : 0,
    falloff,
    wobble,
    cameraKickDeg: feel.cameraKickDeg,
    cameraKickWorldX: feel.cameraKickWorldX,
    hudShakePx: feel.hudShakePx,
    hudDropPx: feel.hudDropPx,
    flashAlpha: falloff * feel.flashAlpha,
    vignetteAlpha: falloff * feel.vignetteAlpha,
    recoveryScale: 1 - ((1 - feel.recoveryScale) * falloff),
    cameraKickWorldXCurrent: -wobble * feel.cameraKickWorldX,
    cameraYawDegreesCurrent: -wobble * feel.cameraKickDeg,
    hudShakeX: -wobble * feel.hudShakePx,
    hudDropY: falloff * feel.hudDropPx,
  };
};
