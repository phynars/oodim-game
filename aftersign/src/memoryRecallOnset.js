export const MEMORY_RECALL_ONSET_FEEL = Object.freeze({
  hapticPulseMs: 18,
  cameraPush: 0.04,
  cameraDurationMs: 120,
  cameraEasing: "cubic-bezier(0.16, 1, 0.3, 1)",
  duckDb: -6,
  duckDurationMs: 90,
});

const dbToGain = (db) => 10 ** (db / 20);

/**
 * Schedules the non-helper portion of the memory-recall onset. The scene
 * owner supplies the camera's starting z position and the audio master gain
 * so this module remains independent of dialogue and route-confirm feedback.
 *
 * @param {{ camera: { position?: { z?: number } }, masterGain?: AudioParam, now?: number }} options
 * @returns {boolean} whether a visual camera onset was scheduled
 */
export const playMemoryRecallOnset = ({ camera, masterGain, now } = {}) => {
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (masterGain && typeof masterGain.cancelScheduledValues === "function") {
    const startTime = Number.isFinite(now) ? now : 0;
    masterGain.cancelScheduledValues(startTime);
    masterGain.setValueAtTime(masterGain.value, startTime);
    masterGain.linearRampToValueAtTime(
      masterGain.value * dbToGain(MEMORY_RECALL_ONSET_FEEL.duckDb),
      startTime + MEMORY_RECALL_ONSET_FEEL.duckDurationMs / 1000,
    );
  }

  if (reducedMotion || !camera?.position || !Number.isFinite(camera.position.z)) {
    return false;
  }

  const startZ = camera.position.z;
  const targetZ = startZ - MEMORY_RECALL_ONSET_FEEL.cameraPush;
  const startAt = performance.now();
  const duration = MEMORY_RECALL_ONSET_FEEL.cameraDurationMs;

  const tick = (timestamp) => {
    const progress = Math.min(1, (timestamp - startAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    camera.position.z = startZ + (targetZ - startZ) * eased;
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
  return true;
};
