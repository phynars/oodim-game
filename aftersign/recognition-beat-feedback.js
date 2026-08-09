export const IO_RECOGNITION_BEAT_FEEDBACK = Object.freeze({
  durationMs: 1220,
  reducedMotionDurationMs: 160,
  inputLockMs: 1220,
  cameraPeakMs: 520,
  cameraDeltaMeters: 0.32,
  cameraYawDegrees: 4,
  openedTargetOffsetMeters: 0.08,
  sealedTargetOffsetMeters: -0.04,
  glowStartMs: 80,
  glowRiseMs: 140,
  glowFromMultiplier: 0.8,
  glowToMultiplier: 1.35,
  stingStartMs: 120,
  stingDurationMs: 180,
  stingGainDb: -9,
  openedWoodenClickDelayMs: 45,
  impactBurst: Object.freeze({
    anticipationHoldMs: 120,
    particleBurstCount: 14,
    particleBurstStartFrame: 4,
    particleBurstDurationMs: 260,
    particleSpreadDegrees: 72,
    particleSpeedPxPerSecond: 42,
    chirpFrequencyHz: 880,
    chirpFrame: 4,
    chirpDurationMs: 90,
    eyeOpenAnimationFps: 60,
  }),
  outcomeCues: Object.freeze({
    sealed: Object.freeze({
      lantern: Object.freeze({
        startMs: 70,
        durationMs: 360,
        easing: "easeOutCubic",
        intensityFrom: 0.72,
        intensityTo: 1.18,
        color: "#f5c978",
      }),
      packetSeal: Object.freeze({
        startMs: 128,
        durationMs: 180,
        easing: "bell",
        intensityFrom: 0.55,
        intensityTo: 1.35,
        color: "#ffcf70",
        audioId: "seal-wax-click",
      }),
      kioskSign: Object.freeze({
        startMs: 90,
        durationMs: 420,
        easing: "easeInOutSine",
        intensityFrom: 0.9,
        intensityTo: 1.24,
        color: "#ffd99a",
      }),
      rainRim: Object.freeze({
        startMs: 160,
        durationMs: 520,
        easing: "easeOutCubic",
        intensityFrom: 0.4,
        intensityTo: 0.64,
        color: "#9cc8ff",
      }),
      hapticScale: Object.freeze({
        startMs: 128,
        durationMs: 54,
        easing: "bell",
        amplitude: 0.34,
      }),
      audioCueIds: Object.freeze(["recognition-sting", "seal-wax-click", "bell-soft"]),
    }),
    opened: Object.freeze({
      lantern: Object.freeze({
        startMs: 60,
        durationMs: 440,
        easing: "easeOutCubic",
        intensityFrom: 0.7,
        intensityTo: 1.42,
        color: "#ffe1a8",
      }),
      packetSeal: Object.freeze({
        startMs: 165,
        durationMs: 210,
        easing: "bell",
        intensityFrom: 0.48,
        intensityTo: 1.05,
        color: "#b7d8ff",
        audioId: "seal-paper-tear",
      }),
      kioskSign: Object.freeze({
        startMs: 80,
        durationMs: 500,
        easing: "easeInOutSine",
        intensityFrom: 0.9,
        intensityTo: 1.38,
        color: "#ffe6b8",
      }),
      rainRim: Object.freeze({
        startMs: 140,
        durationMs: 620,
        easing: "easeOutCubic",
        intensityFrom: 0.42,
        intensityTo: 0.82,
        color: "#bfe1ff",
      }),
      hapticScale: Object.freeze({
        startMs: 165,
        durationMs: 72,
        easing: "bell",
        amplitude: 0.22,
      }),
      audioCueIds: Object.freeze(["recognition-sting", "seal-paper-tear", "bell-soft"]),
    }),
  }),
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value) => 1 - ((1 - clamp01(value)) ** 3);
const easeInOutSine = (value) => (1 - Math.cos(Math.PI * clamp01(value))) / 2;
const bellEnvelope = (elapsedMs, durationMs) => Math.sin(Math.PI * clamp01(elapsedMs / durationMs));

const impactBurstAt = (elapsedMs, impactBurst, reducedMotionApplied) => {
  if (reducedMotionApplied) {
    return {
      particles: [],
      chirp: {
        shouldTrigger: false,
        frequencyHz: impactBurst.chirpFrequencyHz,
        durationMs: impactBurst.chirpDurationMs,
      },
    };
  }

  const frameMs = 1000 / impactBurst.eyeOpenAnimationFps;
  const burstStartMs =
    impactBurst.anticipationHoldMs + impactBurst.particleBurstStartFrame * frameMs;
  const chirpStartMs = impactBurst.anticipationHoldMs + impactBurst.chirpFrame * frameMs;

  const burstElapsedMs = elapsedMs - burstStartMs;
  const burstProgress = clamp01(burstElapsedMs / impactBurst.particleBurstDurationMs);
  const burstActive = burstElapsedMs >= 0 && burstElapsedMs <= impactBurst.particleBurstDurationMs;
  const halfSpread = impactBurst.particleSpreadDegrees / 2;
  const particles = burstActive
    ? Array.from({ length: impactBurst.particleBurstCount }, (_, index) => {
        const angleProgress =
          impactBurst.particleBurstCount <= 1
            ? 0
            : index / (impactBurst.particleBurstCount - 1);
        const angleDeg = -halfSpread + angleProgress * impactBurst.particleSpreadDegrees;
        const angleRad = (angleDeg * Math.PI) / 180;
        const distance = impactBurst.particleSpeedPxPerSecond * (burstElapsedMs / 1000);
        return {
          index,
          angleDeg: Number(angleDeg.toFixed(2)),
          x: Number((Math.cos(angleRad) * distance).toFixed(2)),
          y: Number((Math.sin(angleRad) * distance).toFixed(2)),
          alpha: Number((1 - burstProgress).toFixed(3)),
          scale: Number((0.7 + (1 - burstProgress) * 0.45).toFixed(3)),
        };
      })
    : [];

  return {
    particles,
    chirp: {
      shouldTrigger: elapsedMs >= chirpStartMs && elapsedMs < chirpStartMs + frameMs,
      frequencyHz: impactBurst.chirpFrequencyHz,
      durationMs: impactBurst.chirpDurationMs,
    },
  };
};

export const ioRecognitionBeatEnvelopeAt = (
  elapsedMs,
  outcome = "sealed",
  feedback = IO_RECOGNITION_BEAT_FEEDBACK,
) => {
  const safeElapsedMs = Math.max(0, Math.min(elapsedMs, feedback.durationMs));
  const cameraRise = easeOutCubic(safeElapsedMs / feedback.cameraPeakMs);
  const cameraSettle = 1 - 0.06 * easeInOutSine((safeElapsedMs - feedback.cameraPeakMs) / 420);
  const cameraShape = safeElapsedMs <= feedback.cameraPeakMs ? cameraRise : cameraSettle;

  const glowElapsedMs = safeElapsedMs - feedback.glowStartMs;
  const glowProgress = clamp01(glowElapsedMs / feedback.glowRiseMs);
  const signGlowMultiplier =
    feedback.glowFromMultiplier +
    (feedback.glowToMultiplier - feedback.glowFromMultiplier) * easeOutCubic(glowProgress);

  const stingElapsedMs = safeElapsedMs - feedback.stingStartMs;
  const stingGainDb =
    stingElapsedMs >= 0 && stingElapsedMs <= feedback.stingDurationMs
      ? feedback.stingGainDb + bellEnvelope(stingElapsedMs, feedback.stingDurationMs) * 1.5
      : null;

  const safeOutcome = outcome === "opened" ? "opened" : "sealed";
  const reducedMotionApplied = feedback.durationMs === feedback.reducedMotionDurationMs;
  const impactBurst = impactBurstAt(safeElapsedMs, feedback.impactBurst, reducedMotionApplied);

  return {
    normalized: clamp01(safeElapsedMs / feedback.durationMs),
    cameraDeltaMeters: Number((feedback.cameraDeltaMeters * cameraShape).toFixed(3)),
    cameraYawDegrees: Number((feedback.cameraYawDegrees * cameraShape).toFixed(2)),
    cameraTargetOffsetMeters:
      safeOutcome === "opened" ? feedback.openedTargetOffsetMeters : feedback.sealedTargetOffsetMeters,
    signGlowMultiplier: Number(signGlowMultiplier.toFixed(3)),
    signGlowBoost: Number((signGlowMultiplier - 1).toFixed(3)),
    stingGainDb: stingGainDb === null ? null : Number(stingGainDb.toFixed(2)),
    stingElapsedMs: stingGainDb === null ? null : stingElapsedMs,
    woodenClickElapsedMs:
      safeOutcome === "opened"
        ? Math.max(0, safeElapsedMs - (feedback.stingStartMs + feedback.openedWoodenClickDelayMs))
        : null,
    inputLockMs: feedback.inputLockMs,
    impactBurst,
    ...feedback.outcomeCues[safeOutcome],
  };
};
