export const DEFAULT_RECOGNITION_BEAT_FEEL = Object.freeze({
  durationMs: 1180,
  settleMs: 980,
  cameraDollyMeters: 0.18,
  cameraYawDegrees: 4.5,
  signGlowAlpha: 0.82,
  vignetteAlpha: 0.18,
  bloomBoost: 0.16,
  dialogueLiftPx: 6,
  bellDuckDb: -5,
});

export function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function easeOutCubic(t) {
  const k = 1 - clamp01(t);
  return 1 - k * k * k;
}

export function easeInOutSine(t) {
  return 0.5 - Math.cos(Math.PI * clamp01(t)) / 2;
}

export function recognitionBeatEnvelopeAt(elapsedMs, feel = DEFAULT_RECOGNITION_BEAT_FEEL) {
  const progress = clamp01(elapsedMs / feel.durationMs);
  const arrival = easeOutCubic(Math.min(elapsedMs, 420) / 420);
  const hold = elapsedMs < 720 ? 1 : clamp01(1 - (elapsedMs - 720) / (feel.durationMs - 720));
  const breathe = Math.sin(progress * Math.PI);
  const settle = easeInOutSine(Math.min(elapsedMs, feel.settleMs) / feel.settleMs);

  return {
    progress,
    cameraDollyMeters: Number((feel.cameraDollyMeters * arrival * hold).toFixed(4)),
    cameraYawDegrees: Number((feel.cameraYawDegrees * arrival * hold).toFixed(3)),
    signGlowAlpha: Number((feel.signGlowAlpha * Math.max(hold, 0.34 * breathe)).toFixed(3)),
    vignetteAlpha: Number((feel.vignetteAlpha * breathe).toFixed(3)),
    bloomBoost: Number((feel.bloomBoost * breathe).toFixed(3)),
    dialogueLiftPx: Number((feel.dialogueLiftPx * settle).toFixed(2)),
    bellDuckDb: Number((feel.bellDuckDb * hold).toFixed(2)),
  };
}
