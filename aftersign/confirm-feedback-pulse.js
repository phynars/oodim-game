const CONFIRM_PULSE_MS = 120;
const CONFIRM_PULSE_MIN_SCALE = 0.92;
const CONFIRM_PULSE_MAX_SCALE = 1;

function easeOutCubic(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - ((1 - clamped) ** 3);
}

function sampleConfirmPulse(elapsedMs) {
  const progress = Math.max(0, Math.min(1, elapsedMs / CONFIRM_PULSE_MS));
  return {
    durationMs: CONFIRM_PULSE_MS,
    scale: CONFIRM_PULSE_MIN_SCALE + ((CONFIRM_PULSE_MAX_SCALE - CONFIRM_PULSE_MIN_SCALE) * easeOutCubic(progress)),
    complete: progress === 1,
  };
}

export {
  CONFIRM_PULSE_MAX_SCALE,
  CONFIRM_PULSE_MIN_SCALE,
  CONFIRM_PULSE_MS,
  easeOutCubic,
  sampleConfirmPulse,
};
