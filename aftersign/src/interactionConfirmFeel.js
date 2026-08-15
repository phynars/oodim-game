// AFTERSIGN interaction-confirm feel token + envelope.
//
// Player-visible intent: when the player commits a kiosk / packet action, the
// surface should answer inside one frame with a small reticle pop, a screen
// nudge, and a single bright 880Hz confirm chirp.  Keep this file pure so the
// served page and e2e assertions can share one set of numbers without drifting.

export const INTERACTION_CONFIRM_FEEL = Object.freeze({
  durationMs: 220,
  easing: "easeOutCubic",
  reticleScalePeak: 1.08,
  reticleLiftPx: 3,
  cameraKickDeg: 1.4,
  cameraKickWorldX: 0.055,
  hudShakePx: 10,
  hudLiftPx: 3,
  pulseDecayPerSecond: 3.8,
  audioCue: Object.freeze({
    name: "interaction-confirm-880hz",
    frequencyHz: 880,
    durationMs: 90,
    attackMs: 12,
    releaseMs: 78,
    peakGain: 0.11,
  }),
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const easeOutCubicConfirm = (value) => 1 - ((1 - clamp01(value)) ** 3);

export const interactionConfirmEnvelopeAt = (
  elapsedMs,
  feel = INTERACTION_CONFIRM_FEEL,
) => {
  const progress = clamp01(elapsedMs / feel.durationMs);
  const intensity = easeOutCubicConfirm(progress);
  const falloff = 1 - intensity;
  const wobble = falloff * Math.sin(progress * Math.PI * 6);

  return {
    active: progress < 1,
    progress,
    falloff,
    wobble,
    reticleScale: 1 + falloff * (feel.reticleScalePeak - 1),
    reticleLiftPx: -falloff * feel.reticleLiftPx,
    hudShakeX: Math.round(wobble * feel.hudShakePx),
    hudLiftY: Math.round(-falloff * feel.hudLiftPx),
    cameraKickWorldX: wobble * feel.cameraKickWorldX,
    cameraKickDeg: wobble * feel.cameraKickDeg,
  };
};
