export type PacketOutcome = "sealed" | "opened";

export interface RecognitionBeatCue {
  readonly line: string;
  readonly cameraPushMs: number;
  readonly cameraPushMeters: number;
  readonly cameraEase: "cubic-bezier(.2,.8,.2,1)";
  readonly signGlowDelayMs: number;
  readonly signGlowDurationMs: number;
  readonly signGlowPeakIntensity: number;
  readonly stingDelayMs: number;
  readonly stingDurationMs: number;
  readonly screenLiftPx: number;
  readonly screenShakePx: number;
  readonly hapticVisualPulseMs: number;
}

export interface RecognitionBeatState {
  readonly outcome: PacketOutcome;
  readonly listenedToRoute: boolean;
}

const BASE_RECOGNITION_BEAT = {
  cameraPushMs: 420,
  cameraPushMeters: 0.34,
  cameraEase: "cubic-bezier(.2,.8,.2,1)",
  signGlowDelayMs: 120,
  signGlowDurationMs: 560,
  signGlowPeakIntensity: 1.35,
  stingDelayMs: 180,
  stingDurationMs: 700,
  screenLiftPx: 6,
  screenShakePx: 0.8,
  hapticVisualPulseMs: 90,
} as const;

export function ioRecognitionBeat(state: RecognitionBeatState): RecognitionBeatCue {
  const line = state.outcome === "sealed"
    ? "You came back. So did the blue seal, unbroken. That gives me two facts to trust."
    : "You came back. The seal did not. I can use one of those facts.";

  return {
    ...BASE_RECOGNITION_BEAT,
    line: state.listenedToRoute
      ? line
      : `${line} Next time, let me finish saving your life.`,
  };
}

export function recognitionBeatProgress(elapsedMs: number): {
  readonly camera: number;
  readonly glow: number;
  readonly sting: number;
  readonly liftPx: number;
  readonly shakePx: number;
} {
  const camera = easeOutCubic(clamp01(elapsedMs / BASE_RECOGNITION_BEAT.cameraPushMs));
  const glow = pulse(
    elapsedMs - BASE_RECOGNITION_BEAT.signGlowDelayMs,
    BASE_RECOGNITION_BEAT.signGlowDurationMs,
  );
  const sting = pulse(
    elapsedMs - BASE_RECOGNITION_BEAT.stingDelayMs,
    BASE_RECOGNITION_BEAT.stingDurationMs,
  );
  const lift = pulse(elapsedMs, BASE_RECOGNITION_BEAT.hapticVisualPulseMs);

  return {
    camera,
    glow,
    sting,
    liftPx: BASE_RECOGNITION_BEAT.screenLiftPx * lift,
    shakePx: BASE_RECOGNITION_BEAT.screenShakePx * Math.sin(elapsedMs * 0.11) * (1 - sting),
  };
}

function pulse(elapsedMs: number, durationMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= durationMs) {
    return 0;
  }

  const t = elapsedMs / durationMs;
  return Math.sin(Math.PI * t);
}

function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}
