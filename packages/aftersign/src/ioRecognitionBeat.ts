export type IoPacketOutcome = "sealed" | "opened";

export type IoRecognitionBeatCue = {
  readonly kind: "io-recognition-beat";
  readonly packetOutcome: IoPacketOutcome;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly easing: "cubic-bezier(.2,.8,.2,1)";
  readonly cameraPushInMeters: number;
  readonly cameraLiftMeters: number;
  readonly signGlowPeak: number;
  readonly signGlowDelayMs: number;
  readonly bellStingDelayMs: number;
  readonly subtitleSettleDelayMs: number;
  readonly reducedMotionDurationMs: number;
};

export type IoRecognitionBeatState = {
  lastCue?: "io-recognition-beat";
  lastCueAt?: number;
  statePublishVersion: number;
  ioRecognitionBeat?: IoRecognitionBeatCue;
};

export const IO_RECOGNITION_BEAT_DURATION_MS = 420;
export const IO_RECOGNITION_BEAT_EASING = "cubic-bezier(.2,.8,.2,1)" as const;
export const IO_RECOGNITION_CAMERA_PUSH_IN_METERS = 0.28;
export const IO_RECOGNITION_CAMERA_LIFT_METERS = 0.04;
export const IO_RECOGNITION_SIGN_GLOW_PEAK = 1.35;
export const IO_RECOGNITION_SIGN_GLOW_DELAY_MS = 80;
export const IO_RECOGNITION_BELL_STING_DELAY_MS = 130;
export const IO_RECOGNITION_SUBTITLE_SETTLE_DELAY_MS = 180;
export const IO_RECOGNITION_REDUCED_MOTION_DURATION_MS = 140;

export function createIoRecognitionBeatState(): IoRecognitionBeatState {
  return {
    statePublishVersion: 0,
  };
}

export function playIoRecognitionBeat(
  state: IoRecognitionBeatState,
  packetOutcome: IoPacketOutcome,
  startedAtMs: number,
): IoRecognitionBeatCue {
  const cue: IoRecognitionBeatCue = {
    kind: "io-recognition-beat",
    packetOutcome,
    startedAtMs,
    durationMs: IO_RECOGNITION_BEAT_DURATION_MS,
    easing: IO_RECOGNITION_BEAT_EASING,
    cameraPushInMeters: IO_RECOGNITION_CAMERA_PUSH_IN_METERS,
    cameraLiftMeters: IO_RECOGNITION_CAMERA_LIFT_METERS,
    signGlowPeak: IO_RECOGNITION_SIGN_GLOW_PEAK,
    signGlowDelayMs: IO_RECOGNITION_SIGN_GLOW_DELAY_MS,
    bellStingDelayMs: IO_RECOGNITION_BELL_STING_DELAY_MS,
    subtitleSettleDelayMs: IO_RECOGNITION_SUBTITLE_SETTLE_DELAY_MS,
    reducedMotionDurationMs: IO_RECOGNITION_REDUCED_MOTION_DURATION_MS,
  };

  state.ioRecognitionBeat = cue;
  state.lastCue = cue.kind;
  state.lastCueAt = startedAtMs;
  state.statePublishVersion += 1;

  return cue;
}

export function assertIoRecognitionBeatCue(
  before: IoRecognitionBeatState,
  after: IoRecognitionBeatState,
  cue: IoRecognitionBeatCue,
  packetOutcome: IoPacketOutcome,
  startedAtMs: number,
): void {
  if (cue.kind !== "io-recognition-beat") {
    throw new Error(`Expected io-recognition-beat cue, received ${cue.kind}`);
  }

  if (cue.packetOutcome !== packetOutcome) {
    throw new Error(
      `Expected Io recognition outcome ${packetOutcome}, received ${cue.packetOutcome}`,
    );
  }

  if (cue.startedAtMs !== startedAtMs) {
    throw new Error(
      `Expected Io recognition to start at ${startedAtMs}ms, received ${cue.startedAtMs}ms`,
    );
  }

  if (cue.durationMs !== IO_RECOGNITION_BEAT_DURATION_MS) {
    throw new Error(
      `Expected ${IO_RECOGNITION_BEAT_DURATION_MS}ms recognition beat, received ${cue.durationMs}ms`,
    );
  }

  if (cue.easing !== IO_RECOGNITION_BEAT_EASING) {
    throw new Error(`Expected easing ${IO_RECOGNITION_BEAT_EASING}, received ${cue.easing}`);
  }

  if (cue.cameraPushInMeters !== IO_RECOGNITION_CAMERA_PUSH_IN_METERS) {
    throw new Error(
      `Expected ${IO_RECOGNITION_CAMERA_PUSH_IN_METERS}m camera push-in, received ${cue.cameraPushInMeters}m`,
    );
  }

  if (cue.cameraLiftMeters !== IO_RECOGNITION_CAMERA_LIFT_METERS) {
    throw new Error(
      `Expected ${IO_RECOGNITION_CAMERA_LIFT_METERS}m camera lift, received ${cue.cameraLiftMeters}m`,
    );
  }

  if (cue.signGlowPeak !== IO_RECOGNITION_SIGN_GLOW_PEAK) {
    throw new Error(
      `Expected ${IO_RECOGNITION_SIGN_GLOW_PEAK}x sign glow peak, received ${cue.signGlowPeak}x`,
    );
  }

  if (cue.signGlowDelayMs !== IO_RECOGNITION_SIGN_GLOW_DELAY_MS) {
    throw new Error(
      `Expected sign glow at ${IO_RECOGNITION_SIGN_GLOW_DELAY_MS}ms, received ${cue.signGlowDelayMs}ms`,
    );
  }

  if (cue.bellStingDelayMs !== IO_RECOGNITION_BELL_STING_DELAY_MS) {
    throw new Error(
      `Expected bell sting at ${IO_RECOGNITION_BELL_STING_DELAY_MS}ms, received ${cue.bellStingDelayMs}ms`,
    );
  }

  if (cue.subtitleSettleDelayMs !== IO_RECOGNITION_SUBTITLE_SETTLE_DELAY_MS) {
    throw new Error(
      `Expected subtitle settle at ${IO_RECOGNITION_SUBTITLE_SETTLE_DELAY_MS}ms, received ${cue.subtitleSettleDelayMs}ms`,
    );
  }

  if (cue.reducedMotionDurationMs !== IO_RECOGNITION_REDUCED_MOTION_DURATION_MS) {
    throw new Error(
      `Expected reduced-motion duration ${IO_RECOGNITION_REDUCED_MOTION_DURATION_MS}ms, received ${cue.reducedMotionDurationMs}ms`,
    );
  }

  if (after.ioRecognitionBeat !== cue) {
    throw new Error("Expected Io recognition cue to be published on story state");
  }

  if (after.lastCue !== cue.kind) {
    throw new Error(`Expected lastCue ${cue.kind}, received ${after.lastCue}`);
  }

  if (after.lastCueAt !== startedAtMs) {
    throw new Error(`Expected lastCueAt ${startedAtMs}, received ${after.lastCueAt}`);
  }

  if (after.statePublishVersion !== before.statePublishVersion + 1) {
    throw new Error(
      `Expected statePublishVersion ${before.statePublishVersion + 1}, received ${after.statePublishVersion}`,
    );
  }
}
