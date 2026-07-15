export const IO_RECOGNITION_BEAT_FEEDBACK = Object.freeze({
  durationMs: 1220,
  cameraDeltaMeters: 0.32,
  cameraYawDegrees: 4,
  signGlowBoost: 1.15,
  bellLightAlpha: 0.42,
  bellLightPeakMs: 520,
  bellLightEasing: "easeOutCubic-then-easeInOutCubic",
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value) => 1 - ((1 - clamp01(value)) ** 3);
const easeInOutCubic = (value) => {
  const k = clamp01(value);
  return k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2;
};

export const ioRecognitionBeatEnvelopeAt = (elapsedMs, feedback = IO_RECOGNITION_BEAT_FEEDBACK) => {
  const safeElapsedMs = Math.max(0, elapsedMs);
  let progress;
  if (safeElapsedMs < 180) {
    progress = easeOutCubic(safeElapsedMs / 180) * 0.25;
  } else if (safeElapsedMs < feedback.bellLightPeakMs) {
    progress = 0.25 + 0.75 * easeInOutCubic((safeElapsedMs - 180) / (feedback.bellLightPeakMs - 180));
  } else {
    progress = 1 - easeOutCubic((safeElapsedMs - feedback.bellLightPeakMs) / (feedback.durationMs - feedback.bellLightPeakMs));
  }
  const normalized = clamp01(progress);
  return {
    normalized,
    cameraDeltaMeters: Number((feedback.cameraDeltaMeters * normalized).toFixed(3)),
    cameraYawDegrees: Number((feedback.cameraYawDegrees * normalized).toFixed(2)),
    signGlowBoost: Number((feedback.signGlowBoost * normalized).toFixed(3)),
    bellLightAlpha: Number((feedback.bellLightAlpha * normalized).toFixed(3)),
  };
};
