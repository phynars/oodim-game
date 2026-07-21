import {
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
  expect(cue.startedAtMs).toBe(startedAtMs);
});

test("Io recognition cue is a thin publisher — no duplicate feel numbers", () => {
  const state = createIoRecognitionBeatState();
  const cue = playIoRecognitionBeat(state, "sealed", 7200);

  // The cue tells the renderer WHEN and WHICH outcome. All timing/camera/glow
  // numbers live in `apps/web/src/aftersign/recognitionFeedback.ts`
  // (`recognitionFeedbackContract`). Keep this cue shape minimal so it can't
  // drift from the contract.
  expect(cue).toEqual({
    kind: "io-recognition-beat",
    packetOutcome: "sealed",
    startedAtMs: 7200,
  });

  expect(Object.keys(cue).sort()).toEqual(["kind", "packetOutcome", "startedAtMs"]);
});

test("Io recognition state initializes with explicit null fields", () => {
  const state = createIoRecognitionBeatState();

  expect(state.lastCue).toBeNull();
  expect(state.lastCueAt).toBeNull();
  expect(state.ioRecognitionBeat).toBeNull();
  expect(state.statePublishVersion).toBe(0);
});
