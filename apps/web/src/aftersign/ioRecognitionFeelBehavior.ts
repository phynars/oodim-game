export type AftersignIoRecognitionOutcome = "sealed" | "opened";

export interface AftersignIoRecognitionFeelFrame {
  readonly elapsedMs: number;
  readonly cameraLeanDegrees: number;
  readonly cameraPushPx: number;
  readonly signGlow: number;
  readonly bellGain: number;
  readonly rainDuckDb: number;
  readonly hapticPulseMs: number;
}

export interface AftersignIoRecognitionFeelCue {
  readonly outcome: AftersignIoRecognitionOutcome;
  readonly durationMs: number;
  readonly cameraLeanPeakDegrees: number;
  readonly cameraPushPeakPx: number;
  readonly signGlowPeak: number;
  readonly bellStartMs: number;
  readonly bellPeakGain: number;
  readonly rainDuckDb: number;
  readonly hapticPulseMs: number;
  sampleFrame(elapsedMs: number): AftersignIoRecognitionFeelFrame;
}

const IO_RECOGNITION_DURATION_MS = 720;
const IO_RECOGNITION_CAMERA_LEAN_PEAK_DEGREES = 1.8;
const IO_RECOGNITION_CAMERA_PUSH_PEAK_PX = 10;
const IO_RECOGNITION_SIGN_GLOW_PEAK = 0.72;
const IO_RECOGNITION_BELL_START_MS = 90;
const IO_RECOGNITION_BELL_PEAK_GAIN = 0.42;
const IO_RECOGNITION_RAIN_DUCK_DB = -4;
const IO_RECOGNITION_HAPTIC_PULSE_MS = 18;

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(value: number): number {
  const t = clamp01(value);
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function triangleEnvelope(elapsedMs: number, attackMs: number, releaseMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }

  if (elapsedMs < attackMs) {
    return easeOutCubic(elapsedMs / attackMs);
  }

  if (elapsedMs >= releaseMs) {
    return 0;
  }

  return 1 - easeInOutSine((elapsedMs - attackMs) / (releaseMs - attackMs));
}

function bellEnvelope(elapsedMs: number): number {
  const bellElapsedMs = elapsedMs - IO_RECOGNITION_BELL_START_MS;

  if (bellElapsedMs <= 0) {
    return 0;
  }

  return triangleEnvelope(bellElapsedMs, 54, 420);
}

export function sampleAftersignIoRecognitionFeelFrame(
  elapsedMs: number,
): AftersignIoRecognitionFeelFrame {
  const boundedElapsedMs = Math.max(0, Math.min(elapsedMs, IO_RECOGNITION_DURATION_MS));
  const cameraEnvelope = triangleEnvelope(boundedElapsedMs, 180, 540);
  const glowEnvelope = triangleEnvelope(boundedElapsedMs, 120, IO_RECOGNITION_DURATION_MS);
  const bell = bellEnvelope(boundedElapsedMs);

  return {
    elapsedMs: boundedElapsedMs,
    cameraLeanDegrees: Number(
      (IO_RECOGNITION_CAMERA_LEAN_PEAK_DEGREES * cameraEnvelope).toFixed(3),
    ),
    cameraPushPx: Number((IO_RECOGNITION_CAMERA_PUSH_PEAK_PX * cameraEnvelope).toFixed(3)),
    signGlow: Number((IO_RECOGNITION_SIGN_GLOW_PEAK * glowEnvelope).toFixed(3)),
    bellGain: Number((IO_RECOGNITION_BELL_PEAK_GAIN * bell).toFixed(3)),
    rainDuckDb: bell > 0 ? IO_RECOGNITION_RAIN_DUCK_DB : 0,
    hapticPulseMs:
      boundedElapsedMs >= IO_RECOGNITION_BELL_START_MS && boundedElapsedMs < IO_RECOGNITION_BELL_START_MS + 16
        ? IO_RECOGNITION_HAPTIC_PULSE_MS
        : 0,
  };
}

export function createAftersignIoRecognitionFeelCue(
  outcome: AftersignIoRecognitionOutcome,
): AftersignIoRecognitionFeelCue {
  return {
    outcome,
    durationMs: IO_RECOGNITION_DURATION_MS,
    cameraLeanPeakDegrees: IO_RECOGNITION_CAMERA_LEAN_PEAK_DEGREES,
    cameraPushPeakPx: IO_RECOGNITION_CAMERA_PUSH_PEAK_PX,
    signGlowPeak: IO_RECOGNITION_SIGN_GLOW_PEAK,
    bellStartMs: IO_RECOGNITION_BELL_START_MS,
    bellPeakGain: IO_RECOGNITION_BELL_PEAK_GAIN,
    rainDuckDb: IO_RECOGNITION_RAIN_DUCK_DB,
    hapticPulseMs: IO_RECOGNITION_HAPTIC_PULSE_MS,
    sampleFrame: sampleAftersignIoRecognitionFeelFrame,
  };
}
