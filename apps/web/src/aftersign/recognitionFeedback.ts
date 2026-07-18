// Pure-data feel model for Io's recognition memory beat.
//
// The renderer/harness should consume this module as numbers only: no timers,
// DOM, audio nodes, or three.js objects live here. That keeps the beat
// measurable and lets Playwright assert the same contract the game uses.
//
// OWNERSHIP: this module owns the RECOGNITION 3D-scene envelope — camera delta
// and yaw, sign glow multiplier over the full beat, sting gain in dB, wooden
// click timing, and the input lock window. The PHONE-READY sub-envelope for
// the same beat (line rise/opacity, glow opacity gate on mobile, audio gain
// gate, phone settle budget) lives in ./ioPhoneReadyFeel.ts. Together they
// describe the same recognition moment at two zoom levels; keep them
// reconcilable when either changes.

export type RecognitionOutcome = "sealed" | "opened";

export type RecognitionBeatKind = "io-recognition";

export type RecognitionCueEasing = "linear" | "easeOutCubic" | "easeInOutSine" | "bell";

export type RecognitionAudioCueId = "recognition-sting" | "seal-wax-click" | "seal-paper-tear" | "bell-soft";

export interface RecognitionFeedbackOptions {
  outcome?: RecognitionOutcome;
  reducedMotion?: boolean;
  startedAt?: number;
  lineId?: string;
}

export interface RecognitionLightCue {
  startMs: number;
  durationMs: number;
  easing: RecognitionCueEasing;
  intensityFrom: number;
  intensityTo: number;
  color: string;
}

export interface RecognitionPacketSealCue extends RecognitionLightCue {
  audioId: RecognitionAudioCueId;
}

export interface RecognitionHapticScaleCue {
  startMs: number;
  durationMs: number;
  easing: RecognitionCueEasing;
  amplitude: number;
}

export interface RecognitionOutcomeCues {
  lantern: RecognitionLightCue;
  packetSeal: RecognitionPacketSealCue;
  kioskSign: RecognitionLightCue;
  rainRim: RecognitionLightCue;
  hapticScale: RecognitionHapticScaleCue;
  audioCueIds: readonly RecognitionAudioCueId[];
}

export interface RecognitionFeedbackSample {
  kind: RecognitionBeatKind;
  outcome: RecognitionOutcome;
  elapsedMs: number;
  totalMs: number;
  progress: number;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  cameraTargetOffsetMeters: number;
  signGlowMultiplier: number;
  stingGainDb: number | null;
  stingElapsedMs: number | null;
  woodenClickElapsedMs: number | null;
  inputLockMs: number;
  lineId: string;
  startedAt: number;
  endedAt: number | null;
  lantern: RecognitionLightCue;
  packetSeal: RecognitionPacketSealCue;
  kioskSign: RecognitionLightCue;
  rainRim: RecognitionLightCue;
  hapticScale: RecognitionHapticScaleCue;
  audioCueIds: readonly RecognitionAudioCueId[];
}

export interface RecognitionMemoryBeatSnapshot {
  kind: RecognitionBeatKind;
  outcome: RecognitionOutcome;
  startedAt: number;
  endedAt: number | null;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  inputLockMs: number;
  lineId: string;
}

export const recognitionFeedbackContract = {
  kind: "io-recognition" as const,
  totalMs: 1220,
  reducedMotionTotalMs: 160,
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
  outcomeCues: {
    sealed: {
      lantern: {
        startMs: 70,
        durationMs: 360,
        easing: "easeOutCubic" as const,
        intensityFrom: 0.72,
        intensityTo: 1.18,
        color: "#f5c978",
      },
      packetSeal: {
        startMs: 128,
        durationMs: 180,
        easing: "bell" as const,
        intensityFrom: 0.55,
        intensityTo: 1.35,
        color: "#ffcf70",
        audioId: "seal-wax-click" as const,
      },
      kioskSign: {
        startMs: 90,
        durationMs: 420,
        easing: "easeInOutSine" as const,
        intensityFrom: 0.9,
        intensityTo: 1.24,
        color: "#ffd99a",
      },
      rainRim: {
        startMs: 160,
        durationMs: 520,
        easing: "easeOutCubic" as const,
        intensityFrom: 0.4,
        intensityTo: 0.64,
        color: "#9cc8ff",
      },
      hapticScale: {
        startMs: 128,
        durationMs: 54,
        easing: "bell" as const,
        amplitude: 0.34,
      },
      audioCueIds: ["recognition-sting", "seal-wax-click", "bell-soft"] as const,
    },
    opened: {
      lantern: {
        startMs: 60,
        durationMs: 440,
        easing: "easeOutCubic" as const,
        intensityFrom: 0.7,
        intensityTo: 1.42,
        color: "#ffe1a8",
      },
      packetSeal: {
        startMs: 165,
        durationMs: 210,
        easing: "bell" as const,
        intensityFrom: 0.48,
        intensityTo: 1.05,
        color: "#b7d8ff",
        audioId: "seal-paper-tear" as const,
      },
      kioskSign: {
        startMs: 80,
        durationMs: 500,
        easing: "easeInOutSine" as const,
        intensityFrom: 0.9,
        intensityTo: 1.38,
        color: "#ffe6b8",
      },
      rainRim: {
        startMs: 140,
        durationMs: 620,
        easing: "easeOutCubic" as const,
        intensityFrom: 0.42,
        intensityTo: 0.82,
        color: "#bfe1ff",
      },
      hapticScale: {
        startMs: 165,
        durationMs: 72,
        easing: "bell" as const,
        amplitude: 0.22,
      },
      audioCueIds: ["recognition-sting", "seal-paper-tear", "bell-soft"] as const,
    },
  },
} as const;

const DEFAULT_LINE_ID = "io.recognition.returning.v1";

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function easeOutCubic(t: number): number {
  const k = 1 - clamp01(t);
  return 1 - k * k * k;
}

function easeInOutSine(t: number): number {
  return (1 - Math.cos(Math.PI * clamp01(t))) / 2;
}

function bellEnvelope(elapsedMs: number, durationMs: number): number {
  const t = clamp01(elapsedMs / durationMs);
  return Math.sin(Math.PI * t);
}

export function getRecognitionFeedbackDuration(options: RecognitionFeedbackOptions = {}): number {
  return options.reducedMotion
    ? recognitionFeedbackContract.reducedMotionTotalMs
    : recognitionFeedbackContract.totalMs;
}

export function sampleRecognitionFeedbackBeat(
  elapsedMs: number,
  options: RecognitionFeedbackOptions = {},
): RecognitionFeedbackSample {
  const outcome = options.outcome ?? "sealed";
  const outcomeCues = recognitionFeedbackContract.outcomeCues[outcome];
  const totalMs = getRecognitionFeedbackDuration(options);
  const clampedElapsedMs = Math.max(0, Math.min(elapsedMs, totalMs));
  const progress = clamp01(clampedElapsedMs / totalMs);
  const startedAt = options.startedAt ?? 0;
  const endedAt = clampedElapsedMs >= totalMs ? startedAt + totalMs : null;

  if (options.reducedMotion) {
    const glow =
      recognitionFeedbackContract.glowFromMultiplier +
      (recognitionFeedbackContract.glowToMultiplier - recognitionFeedbackContract.glowFromMultiplier) *
        easeInOutSine(progress);

    return {
      kind: recognitionFeedbackContract.kind,
      outcome,
      elapsedMs: clampedElapsedMs,
      totalMs,
      progress,
      cameraDeltaMeters: 0,
      cameraYawDegrees: 0,
      cameraTargetOffsetMeters: 0,
      signGlowMultiplier: glow,
      stingGainDb: recognitionFeedbackContract.stingGainDb,
      stingElapsedMs: clampedElapsedMs,
      woodenClickElapsedMs: null,
      inputLockMs: totalMs,
      lineId: options.lineId ?? DEFAULT_LINE_ID,
      startedAt,
      endedAt,
      ...outcomeCues,
    };
  }

  const cameraRise = easeOutCubic(clampedElapsedMs / recognitionFeedbackContract.cameraPeakMs);
  const cameraSettle = 1 - 0.06 * easeInOutSine((clampedElapsedMs - recognitionFeedbackContract.cameraPeakMs) / 420);
  const cameraShape = clampedElapsedMs <= recognitionFeedbackContract.cameraPeakMs ? cameraRise : cameraSettle;
  const cameraDeltaMeters = recognitionFeedbackContract.cameraDeltaMeters * cameraShape;
  const cameraYawDegrees = recognitionFeedbackContract.cameraYawDegrees * cameraShape;

  const glowElapsedMs = clampedElapsedMs - recognitionFeedbackContract.glowStartMs;
  const glowProgress = clamp01(glowElapsedMs / recognitionFeedbackContract.glowRiseMs);
  const signGlowMultiplier =
    recognitionFeedbackContract.glowFromMultiplier +
    (recognitionFeedbackContract.glowToMultiplier - recognitionFeedbackContract.glowFromMultiplier) *
      easeOutCubic(glowProgress);

  const stingElapsedMs = clampedElapsedMs - recognitionFeedbackContract.stingStartMs;
  const stingGainDb =
    stingElapsedMs >= 0 && stingElapsedMs <= recognitionFeedbackContract.stingDurationMs
      ? recognitionFeedbackContract.stingGainDb + bellEnvelope(stingElapsedMs, recognitionFeedbackContract.stingDurationMs) * 1.5
      : null;

  const woodenClickElapsedMs =
    outcome === "opened"
      ? clampedElapsedMs - (recognitionFeedbackContract.stingStartMs + recognitionFeedbackContract.openedWoodenClickDelayMs)
      : null;

  return {
    kind: recognitionFeedbackContract.kind,
    outcome,
    elapsedMs: clampedElapsedMs,
    totalMs,
    progress,
    cameraDeltaMeters,
    cameraYawDegrees,
    cameraTargetOffsetMeters:
      outcome === "opened"
        ? recognitionFeedbackContract.openedTargetOffsetMeters
        : recognitionFeedbackContract.sealedTargetOffsetMeters,
    signGlowMultiplier,
    stingGainDb,
    stingElapsedMs: stingGainDb === null ? null : stingElapsedMs,
    woodenClickElapsedMs: woodenClickElapsedMs !== null && woodenClickElapsedMs >= 0 ? woodenClickElapsedMs : null,
    inputLockMs: recognitionFeedbackContract.inputLockMs,
    lineId: options.lineId ?? DEFAULT_LINE_ID,
    startedAt,
    endedAt,
    ...outcomeCues,
  };
}

export function toRecognitionMemoryBeatSnapshot(
  sample: RecognitionFeedbackSample,
): RecognitionMemoryBeatSnapshot {
  return {
    kind: sample.kind,
    outcome: sample.outcome,
    startedAt: sample.startedAt,
    endedAt: sample.endedAt,
    cameraDeltaMeters: sample.cameraDeltaMeters,
    cameraYawDegrees: sample.cameraYawDegrees,
    inputLockMs: sample.inputLockMs,
    lineId: sample.lineId,
  };
}
