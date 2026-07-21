// Story-state publisher for Io's recognition beat.
//
// This module OWNS the state-publish side of the beat: stamping a cue on
// `IoRecognitionBeatState` so the harness/renderer can react. It does NOT
// own the feel numbers.
//
// WIRE-UP (as of PR #751):
//   PRODUCER  — `openAftersignIoRecognitionBeat` in
//     `apps/web/src/aftersign/verticalSliceState.ts` calls
//     `playIoRecognitionBeat` the moment Io recognizes the returning player
//     and stamps the cue on story state.
//   RENDERER  — `sampleAftersignIoRecognitionEnvelope` (same file) reads the
//     stamped cue and delegates to `sampleRecognitionFeedbackBeat` for the
//     per-ms envelope. That's the live consumer of the cue.
//
// SOURCE OF TRUTH for duration, camera delta, sign glow, sting timing, and
// reduced-motion budget is `apps/web/src/aftersign/recognitionFeedback.ts`
// (`recognitionFeedbackContract` + `sampleRecognitionFeedbackBeat`). That
// file publishes a per-ms sample of the whole envelope and is what the
// renderer/PW tests already consume. This cue tells the renderer *when* to
// start sampling and *which outcome branch* to walk — nothing more.
//
// Do not add duration/easing/camera/glow constants here. If you feel the
// urge, edit `recognitionFeedbackContract` instead and let this module
// stay a thin publisher.

export type IoPacketOutcome = "sealed" | "opened";

export type IoRecognitionBeatCue = {
  readonly kind: "io-recognition-beat";
  readonly packetOutcome: IoPacketOutcome;
  readonly startedAtMs: number;
};

export type IoRecognitionBeatState = {
  lastCue: "io-recognition-beat" | null;
  lastCueAt: number | null;
  statePublishVersion: number;
  ioRecognitionBeat: IoRecognitionBeatCue | null;
};

export function createIoRecognitionBeatState(): IoRecognitionBeatState {
  return {
    lastCue: null,
    lastCueAt: null,
    statePublishVersion: 0,
    ioRecognitionBeat: null,
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
