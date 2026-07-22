import {
  sampleRecognitionFeedbackBeat,
  type RecognitionFeedbackSample,
  type RecognitionOutcome,
} from "./recognitionFeedback";

export type IoRecognitionFeelCue = {
  packetOutcome: RecognitionOutcome;
  startedAtMs: number;
};

export type IoRecognitionCameraMicroLean = {
  forwardMeters: number;
  yawDegrees: number;
  targetOffsetMeters: number;
};

export type IoRecognitionAudioSting = {
  cueId: "recognition-sting";
  gainDb: number;
  elapsedMs: number;
} | null;

export type IoRecognitionFeelLayerFrame = {
  sample: RecognitionFeedbackSample;
  camera: IoRecognitionCameraMicroLean;
  audioSting: IoRecognitionAudioSting;
  inputLocked: boolean;
};

export function sampleIoRecognitionFeelLayer(
  cue: IoRecognitionFeelCue,
  nowMs: number,
  options: { reducedMotion?: boolean; lineId?: string } = {},
): IoRecognitionFeelLayerFrame {
  assertFiniteNonNegative(cue.startedAtMs, "cue.startedAtMs");
  assertFiniteNonNegative(nowMs, "nowMs");

  const elapsedMs = Math.max(0, nowMs - cue.startedAtMs);
  const sample = sampleRecognitionFeedbackBeat(elapsedMs, {
    outcome: cue.packetOutcome,
    startedAt: cue.startedAtMs,
    reducedMotion: options.reducedMotion,
    lineId: options.lineId,
  });

  return {
    sample,
    camera: {
      forwardMeters: sample.cameraDeltaMeters,
      yawDegrees: sample.cameraYawDegrees,
      targetOffsetMeters: sample.cameraTargetOffsetMeters,
    },
    audioSting:
      sample.stingGainDb === null || sample.stingElapsedMs === null
        ? null
        : {
            cueId: "recognition-sting",
            gainDb: sample.stingGainDb,
            elapsedMs: sample.stingElapsedMs,
          },
    inputLocked: elapsedMs < sample.inputLockMs,
  };
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
}
