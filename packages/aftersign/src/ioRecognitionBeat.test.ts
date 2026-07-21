import {
  IO_RECOGNITION_BEAT_DURATION_MS,
  IO_RECOGNITION_BELL_STING_DELAY_MS,
  IO_RECOGNITION_CAMERA_LIFT_METERS,
  IO_RECOGNITION_CAMERA_PUSH_IN_METERS,
  IO_RECOGNITION_REDUCED_MOTION_DURATION_MS,
  IO_RECOGNITION_SIGN_GLOW_DELAY_MS,
  IO_RECOGNITION_SIGN_GLOW_PEAK,
  IO_RECOGNITION_SUBTITLE_SETTLE_DELAY_MS,
  assertIoRecognitionBeatCue,
  createIoRecognitionBeatState,
  playIoRecognitionBeat,
} from "./ioRecognitionBeat";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

test("Io recognition beat stamps sealed-packet cue synchronously", () => {
  const state = createIoRecognitionBeatState();
  const before = cloneState(state);
  const startedAtMs = 3200;

  const cue = playIoRecognitionBeat(state, "sealed", startedAtMs);

  assertIoRecognitionBeatCue(before, state, cue, "sealed", startedAtMs);
  expect(state.lastCue).toBe("io-recognition-beat");
  expect(state.lastCueAt).toBe(startedAtMs);
  expect(state.statePublishVersion).toBe(before.statePublishVersion + 1);
  expect(state.ioRecognitionBeat).toBe(cue);
});

test("Io recognition beat stamps opened-packet cue without changing the feel contract", () => {
  const state = createIoRecognitionBeatState();
  const before = cloneState(state);
  const startedAtMs = 5100;

  const cue = playIoRecognitionBeat(state, "opened", startedAtMs);

  assertIoRecognitionBeatCue(before, state, cue, "opened", startedAtMs);
  expect(cue.packetOutcome).toBe("opened");
  expect(cue.durationMs).toBe(IO_RECOGNITION_BEAT_DURATION_MS);
  expect(cue.cameraPushInMeters).toBe(IO_RECOGNITION_CAMERA_PUSH_IN_METERS);
  expect(cue.cameraLiftMeters).toBe(IO_RECOGNITION_CAMERA_LIFT_METERS);
  expect(cue.signGlowPeak).toBe(IO_RECOGNITION_SIGN_GLOW_PEAK);
});

test("Io recognition beat carries renderer timing for camera, glow, bell, subtitle, and reduced motion", () => {
  const state = createIoRecognitionBeatState();
  const cue = playIoRecognitionBeat(state, "sealed", 7200);

  expect(cue).toEqual({
    kind: "io-recognition-beat",
    packetOutcome: "sealed",
    startedAtMs: 7200,
    durationMs: 420,
    easing: "cubic-bezier(.2,.8,.2,1)",
    cameraPushInMeters: 0.28,
    cameraLiftMeters: 0.04,
    signGlowPeak: 1.35,
    signGlowDelayMs: 80,
    bellStingDelayMs: 130,
    subtitleSettleDelayMs: 180,
    reducedMotionDurationMs: 140,
  });

  expect(IO_RECOGNITION_BELL_STING_DELAY_MS).toBeGreaterThan(IO_RECOGNITION_SIGN_GLOW_DELAY_MS);
  expect(IO_RECOGNITION_SUBTITLE_SETTLE_DELAY_MS).toBeGreaterThan(
    IO_RECOGNITION_BELL_STING_DELAY_MS,
  );
  expect(IO_RECOGNITION_REDUCED_MOTION_DURATION_MS).toBeLessThan(
    IO_RECOGNITION_BEAT_DURATION_MS,
  );
});
