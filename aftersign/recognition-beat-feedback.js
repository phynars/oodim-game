export const IO_RECOGNITION_BEAT_FEEDBACK = Object.freeze({
  durationMs: 1220,
  cameraDeltaMeters: 0.32,
  cameraYawDegrees: 4,
  signGlowBoost: 1.15,
  peakMs: 700,
  riseEasing: "easeOutCubic-then-easeInOutCubic",
  fallEasing: "easeOutCubic",
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value) => 1 - ((1 - clamp01(value)) ** 3);
const easeInOutCubic = (value) => {
  const k = clamp01(value);
  return k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2;
};

// Envelope shape (matches the pre-extraction inline curve in index.html):
//   0    → 180ms   : easeOutCubic ramp to 0.25
//   180  → peakMs  : easeInOutCubic ramp from 0.25 → 1
//   peak → duration: easeOutCubic fall from 1 → 0
// Peak lands at peakMs (700ms by default), fall spans duration-peakMs (520ms).
export const ioRecognitionBeatEnvelopeAt = (elapsedMs, feedback = IO_RECOGNITION_BEAT_FEEDBACK) => {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const peakMs = feedback.peakMs;
  let progress;
  if (safeElapsedMs < 180) {
    progress = easeOutCubic(safeElapsedMs / 180) * 0.25;
  } else if (safeElapsedMs < peakMs) {
    progress = 0.25 + 0.75 * easeInOutCubic((safeElapsedMs - 180) / (peakMs - 180));
  } else {
    progress = 1 - easeOutCubic((safeElapsedMs - peakMs) / (feedback.durationMs - peakMs));
  }
  const normalized = clamp01(progress);
  return {
    normalized,
    cameraDeltaMeters: Number((feedback.cameraDeltaMeters * normalized).toFixed(3)),
    cameraYawDegrees: Number((feedback.cameraYawDegrees * normalized).toFixed(2)),
    signGlowBoost: Number((feedback.signGlowBoost * normalized).toFixed(3)),
  };
};
