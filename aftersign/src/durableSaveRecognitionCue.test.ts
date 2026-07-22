// AFTERSIGN durable-save × recognition-cue wire-up checks.
//
// This is the RUNNABLE twin of the sibling vitest suite at
// `apps/web/src/aftersign/durableSave.contract.test.ts`. Convention (see
// aftersign/README.md + PR #766 review): the `apps/web/src/aftersign/`
// vitest tree is not wired into any CI lane in this repo — root
// `package.json` lists `@playwright/test` only, no vitest. Files there
// are typechecked but never invoked. The load-bearing invocation for
// aftersign lives in a Playwright spec under `aftersign/e2e/` that
// wraps a plain-TS `run*Checks()` runner from `aftersign/src/*.test.ts`.
//
// This module pins the wire-up the sibling vitest asserts:
//
//   1. `openAftersignIoRecognitionBeat` on a durable-save-restored
//      returning session publishes a cue with the frozen shape
//      `{ kind: "io-recognition-beat", packetOutcome, startedAtMs }` —
//      the exact three fields `playIoRecognitionBeat` in
//      `packages/aftersign/src/ioRecognitionBeat.ts` stamps.
//
//   2. `sampleAftersignIoRecognitionEnvelope(cue, nowMs, options)` on
//      that cue matches `sampleRecognitionFeedbackBeat(elapsedMs, ...)`
//      called with `elapsedMs = nowMs - cue.startedAtMs` and the same
//      outcome/startedAt/reducedMotion/lineId — i.e. the cue is what
//      anchors the envelope in time.
//
//   3. `openAftersignIoRecognitionBeat` REFUSES to open when Io does
//      not yet recognize the player, and REFUSES to open when the
//      returning save carries no committed packet outcome.
//
// If any of the above regresses, `runDurableSaveRecognitionCueChecks()`
// throws and the paired Playwright spec turns red under
// `test:e2e:aftersign` — no more green-lie.

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  openAftersignIoRecognitionBeat,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
  sampleAftersignIoMemoryBeat,
  sampleAftersignIoRecognitionEnvelope,
} from "../../apps/web/src/aftersign/verticalSliceState";
import { sampleRecognitionFeedbackBeat } from "../../apps/web/src/aftersign/recognitionFeedback";

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertDeepEqual<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new AssertionError(`${label}: expected ${b}, got ${a}`);
  }
}

function assertThrows(fn: () => unknown, pattern: RegExp, label: string): void {
  let threw = false;
  let message = "";
  try {
    fn();
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  if (!threw) {
    throw new AssertionError(`${label}: expected function to throw, it did not`);
  }
  if (!pattern.test(message)) {
    throw new AssertionError(
      `${label}: expected thrown message to match ${pattern}, got '${message}'`,
    );
  }
}

// Build the state the vitest sibling constructs: choose an outcome, meet
// Io once (first session), durable-save, restore, meet Io again — only
// the second meeting sets `ioRecognizesPlayer = true`, which is what
// unlocks `openAftersignIoRecognitionBeat`.
function returningRecognizedSessionFromDurableSave(
  outcome: "sealed" | "opened",
  savedAtTurn: number,
) {
  const firstSession = meetIoForAftersignSlice(
    recordAftersignPacketChoice(createAftersignVerticalSliceState(), outcome),
  );
  return meetIoForAftersignSlice(
    restoreAftersignDurableSave(encodeAftersignDurableSave(firstSession, savedAtTurn)),
  );
}

export function checkDurableSaveRestoresRecognitionForOpenedOutcome(): void {
  const returning = returningRecognizedSessionFromDurableSave("opened", 20);

  const memoryBeat = sampleAftersignIoMemoryBeat(returning);
  assertEqual(memoryBeat.scene, "io-return", "memoryBeat.scene");
  assertEqual(memoryBeat.recognizesPlayer, true, "memoryBeat.recognizesPlayer");
  assertEqual(memoryBeat.packetOutcome, "opened", "memoryBeat.packetOutcome");
  assert(
    memoryBeat.recognitionFeel === AFTERSIGN_IO_RECOGNITION_FEEL,
    "memoryBeat.recognitionFeel is the live frozen contract",
  );
}

export function checkOpenBeatPublishesCueWithFrozenShape(): void {
  const returning = returningRecognizedSessionFromDurableSave("opened", 20);

  const { cue, cueState } = openAftersignIoRecognitionBeat(returning, 1_200);

  // The frozen cue shape — mirrors playIoRecognitionBeat in
  // packages/aftersign/src/ioRecognitionBeat.ts. Vitest `.toEqual` would
  // fail here if any field drifts; the deep-equal below is the runnable
  // equivalent.
  assertDeepEqual(
    cue,
    {
      kind: "io-recognition-beat",
      packetOutcome: "opened",
      startedAtMs: 1_200,
    },
    "opened cue shape",
  );

  // Cue is also published on the returned cueState — this is what a
  // renderer/harness watches, and it's the second half of the wire-up.
  assertEqual(cueState.lastCue, "io-recognition-beat", "cueState.lastCue");
  assertEqual(cueState.lastCueAt, 1_200, "cueState.lastCueAt");
  assertEqual(cueState.ioRecognitionBeat, cue, "cueState.ioRecognitionBeat === cue");
  assertEqual(cueState.statePublishVersion, 1, "cueState.statePublishVersion");
}

export function checkOpenBeatCarriesSealedOutcomeThrough(): void {
  const returning = returningRecognizedSessionFromDurableSave("sealed", 12);

  const { cue } = openAftersignIoRecognitionBeat(returning, 4_200);

  assertDeepEqual(
    cue,
    {
      kind: "io-recognition-beat",
      packetOutcome: "sealed",
      startedAtMs: 4_200,
    },
    "sealed cue shape",
  );
}

export function checkCueAnchorsEnvelopeInTime(): void {
  // The renderer contract: given a cue and a wall clock `nowMs`, the
  // envelope sample equals `sampleRecognitionFeedbackBeat(nowMs -
  // cue.startedAtMs, { outcome, startedAt, ... })`. This is what makes
  // the cue the anchor — the renderer never re-derives startedAt.
  const returning = returningRecognizedSessionFromDurableSave("opened", 20);
  const { cue } = openAftersignIoRecognitionBeat(returning, 1_200);

  const sampled = sampleAftersignIoRecognitionEnvelope(cue, 1_320, {
    reducedMotion: true,
    lineId: "io-return-opened",
  });
  const expected = sampleRecognitionFeedbackBeat(120, {
    outcome: "opened",
    startedAt: 1_200,
    reducedMotion: true,
    lineId: "io-return-opened",
  });

  assertDeepEqual(sampled, expected, "envelope sample anchored to cue.startedAtMs");
}

export function checkOpenBeatRefusesWhenIoDoesNotRecognizePlayer(): void {
  // First session — Io has not met the player yet. Recording a packet
  // choice does NOT flip `ioRecognizesPlayer`; only the second
  // `meetIoForAftersignSlice` on a state where `ioHasMetPlayer===true` does.
  const firstMeeting = recordAftersignPacketChoice(
    createAftersignVerticalSliceState(),
    "sealed",
  );

  assertThrows(
    () => openAftersignIoRecognitionBeat(firstMeeting, 0),
    /Io does not recognize the player yet/,
    "refuses to open when Io does not recognize the player",
  );
}

export function checkOpenBeatRefusesWhenPacketOutcomeNotCommitted(): void {
  // A returning session that never recorded a packet outcome: meet Io
  // once with no packet choice, save, restore, meet Io again. Io
  // recognizes the player (met twice), but `packetOutcome === null` —
  // the beat must refuse rather than publish a cue with no outcome.
  const returningWithoutPacket = meetIoForAftersignSlice(
    restoreAftersignDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(createAftersignVerticalSliceState()),
        4,
      ),
    ),
  );

  assert(
    returningWithoutPacket.ioRecognizesPlayer === true,
    "returning session must recognize the player (met twice)",
  );
  assert(
    returningWithoutPacket.packetOutcome === null,
    "returning session must have no committed packet outcome",
  );

  assertThrows(
    () => openAftersignIoRecognitionBeat(returningWithoutPacket, 0),
    /packetOutcome is not committed/,
    "refuses to open when packetOutcome is not committed",
  );
}

export function runDurableSaveRecognitionCueChecks(): void {
  checkDurableSaveRestoresRecognitionForOpenedOutcome();
  checkOpenBeatPublishesCueWithFrozenShape();
  checkOpenBeatCarriesSealedOutcomeThrough();
  checkCueAnchorsEnvelopeInTime();
  checkOpenBeatRefusesWhenIoDoesNotRecognizePlayer();
  checkOpenBeatRefusesWhenPacketOutcomeNotCommitted();
}

// Deliberately no top-level `runDurableSaveRecognitionCueChecks()` call
// here — the CI-gating INVOCATION lives in the paired Playwright spec
// `aftersign/e2e/durable-save-recognition-cue-contract.spec.ts` so the
// aftersign lane actually runs the checks under `test:e2e:aftersign`.
// See aftersign/src/recognitionBeat.test.ts's trailing comment for the
// same convention rationale.
