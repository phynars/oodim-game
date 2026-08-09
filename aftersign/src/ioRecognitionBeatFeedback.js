export const DEFAULT_IO_RECOGNITION_BEAT_FEEL = Object.freeze({
  anticipationHoldMs: 120,
  cameraDriftDegrees: 3,
  glowRampMs: 220,
  glowCurve: "easeOutCubic",
  particleBurstCount: 14,
  particleBurstStartFrame: 4,
  particleBurstDurationMs: 260,
  particleSpreadDegrees: 72,
  particleSpeedPxPerSecond: 42,
  eyeOpenAnimationFps: 60,
  chirpFrequencyHz: 880,
  chirpFrame: 4,
  chirpDurationMs: 90,
});

const PARTICLE_DIRECTIONS = Object.freeze([
  [-0.95, -0.2],
  [-0.72, -0.48],
  [-0.48, -0.68],
  [-0.18, -0.82],
  [0.18, -0.82],
  [0.48, -0.68],
  [0.72, -0.48],
  [0.95, -0.2],
  [-0.82, 0.08],
  [-0.54, 0.22],
  [-0.24, 0.34],
  [0.24, 0.34],
  [0.54, 0.22],
  [0.82, 0.08],
]);

export function easeOutCubic(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export function recognitionBeatEnvelopeAt(elapsedMs, feel = DEFAULT_IO_RECOGNITION_BEAT_FEEL) {
  const timeMs = Math.max(0, elapsedMs);
  const afterHoldMs = Math.max(0, timeMs - feel.anticipationHoldMs);
  const glowT = easeOutCubic(afterHoldMs / feel.glowRampMs);
  const particleT = Math.max(0, Math.min(1, afterHoldMs / feel.particleBurstDurationMs));
  const frame = Math.floor((timeMs / 1000) * feel.eyeOpenAnimationFps);

  return {
    elapsedMs: timeMs,
    anticipationHeld: timeMs < feel.anticipationHoldMs,
    cameraDriftDegrees: feel.cameraDriftDegrees * glowT,
    glowAlpha: glowT,
    particleBurst: spawnRecognitionParticles(particleT, feel),
    chirp: {
      shouldTrigger: frame === feel.chirpFrame,
      frequencyHz: feel.chirpFrequencyHz,
      durationMs: feel.chirpDurationMs,
    },
  };
}

export function spawnRecognitionParticles(progress, feel = DEFAULT_IO_RECOGNITION_BEAT_FEEL) {
  const t = Math.max(0, Math.min(1, progress));
  const distance = (feel.particleSpeedPxPerSecond * feel.particleBurstDurationMs * t) / 1000;
  const alpha = 1 - easeOutCubic(t);

  return PARTICLE_DIRECTIONS.slice(0, feel.particleBurstCount).map(([dx, dy], index) => ({
    id: `io-recognition-${index}`,
    x: dx * distance,
    y: dy * distance,
    scale: 0.65 + 0.35 * easeOutCubic(t),
    alpha,
  }));
}
