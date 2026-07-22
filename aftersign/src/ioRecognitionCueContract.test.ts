// AFTERSIGN Io recognition-cue contract checks — runnable twin.
//
// Convention (see aftersign/README.md + PR #766 review):
//   - The `apps/web/src/aftersign/` vitest tree is typechecked but never
//     invoked by any CI lane in this repo (root `package.json` lists
//     `@playwright/test` only, no vitest).
//   - The load-bearing invocation for aftersign lives in a Playwright
//     spec under `aftersign/e2e/` that wraps a plain-TS `run*Checks()`
//     runner exported from `aftersign/src/*.test.ts`.
//
// This runner pins the FROZEN CUE SHAPE contract that
// `playIoRecognitionBeat` (packages/aftersign/src/ioRecognitionBeat.ts)
// has to satisfy — the same shape the sibling vitest at
// `apps/web/src/aftersign/durableSave.contract.test.ts` asserts under
// strict `.toEqual`. The `kind: "io-recognition-beat"` field is
// load-bearing: vitest's strict `toEqual` fails on missing or extra
// fields, and the earlier version of that assertion was rejected on
// #766 for omitting `kind`.
//
// SCOPE — what this file is NOT:
//   - This file does NOT re-test the durable-save round-trip or the
//     envelope-anchor renderer contract. Those live in the vitest
//     sibling (`durableSave.contract.test.ts`) and in the existing
//     memory-store / recognition-feedback runners already wired into
//     `test:e2e:aftersign`.
//   - This file depends ONLY on the frozen contract module in
//     `packages/aftersign/src/ioRecognitionBeat.ts` — already in
//     scope for `typecheck:aftersign` via the sibling
//     recognitionBeat.test.ts imports. It does not reach into
//     `apps/web/src/aftersign/`. An earlier attempt (deleted in this
//     same PR) did, which pulled a fresh compile subgraph
//     (recognitionFeedback, ioReturningRecognitionFeel, interaction/*)
//     into `typecheck:aftersign` (tsconfig `include: ["src"]`) and
//     turned CI red. Staying inside packages/aftersign is what keeps
//     this lane green.

import {
  assertIoRecognitionBeatCue,
  createIoRecognitionBeatState,
  playIoRecognitionBeat,
  type IoRecognitionBeatCue,
  type IoRecognitionBeatState,
} from "../../packages/aftersign/src/ioRecognitionBeat";

class AssertionError extends Error {}

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

function snapshotState(state: IoRecognitionBeatState): IoRecognitionBeatState {
  return {
    lastCue: state.lastCue,
    lastCueAt: state.lastCueAt,
    statePublishVersion: state.statePublishVersion,
    ioRecognitionBeat: state.ioRecognitionBeat,
  };
}

export function checkOpenBeatPublishesCueWithFrozenShape(): void {
  const state = createIoRecognitionBeatState();
  const before = snapshotState(state);

  const cue: IoRecognitionBeatCue = playIoRecognitionBeat(state, "opened", 1_200);

  // Frozen cue shape — the exact three fields `playIoRecognitionBeat`
  // stamps. Vitest `.toEqual` in the sibling would fail if any field
  // drifts; this deep-equal is the runnable equivalent.
  assertDeepEqual(
    cue,
    {
      kind: "io-recognition-beat",
      packetOutcome: "opened",
      startedAtMs: 1_200,
    },
    "opened cue shape",
  );

  // And the cue is published on story state — this is what a renderer
  // watches.
  assertEqual(state.lastCue, "io-recognition-beat", "state.lastCue");
  assertEqual(state.lastCueAt, 1_200, "state.lastCueAt");
  assertEqual(state.ioRecognitionBeat, cue, "state.ioRecognitionBeat === cue");
  assertEqual(state.statePublishVersion, 1, "state.statePublishVersion incremented");

  // The library's own contract-check helper agrees.
  assertIoRecognitionBeatCue(before, state, cue, "opened", 1_200);
}

export function checkOpenBeatCarriesSealedOutcomeThrough(): void {
  const state = createIoRecognitionBeatState();
  const before = snapshotState(state);

  const cue = playIoRecognitionBeat(state, "sealed", 4_200);

  assertDeepEqual(
    cue,
    {
      kind: "io-recognition-beat",
      packetOutcome: "sealed",
      startedAtMs: 4_200,
    },
    "sealed cue shape",
  );

  assertIoRecognitionBeatCue(before, state, cue, "sealed", 4_200);
}

export function checkCueShapeHasNoUnexpectedFields(): void {
  // Belt-and-braces: enumerate the cue's own keys and pin them. If a
  // future change ships a fourth field on the cue, this fires before
  // the vitest sibling would.
  const state = createIoRecognitionBeatState();
  const cue = playIoRecognitionBeat(state, "opened", 0);

  const keys = Object.keys(cue).sort();
  assertDeepEqual(
    keys,
    ["kind", "packetOutcome", "startedAtMs"],
    "cue has exactly {kind, packetOutcome, startedAtMs}",
  );
  assertEqual(cue.kind, "io-recognition-beat", "cue.kind constant");
}

export function checkPublishVersionMonotonicPerBeat(): void {
  // Two beats on the same state must monotonically bump the publish
  // version — that's what lets the renderer detect "a new cue landed".
  const state = createIoRecognitionBeatState();

  playIoRecognitionBeat(state, "opened", 100);
  const versionAfterFirst = state.statePublishVersion;

  playIoRecognitionBeat(state, "sealed", 200);
  const versionAfterSecond = state.statePublishVersion;

  assertEqual(versionAfterFirst, 1, "publishVersion after first beat");
  assertEqual(versionAfterSecond, 2, "publishVersion after second beat");
  assertEqual(state.lastCueAt, 200, "lastCueAt updated to the newest beat");
  assertEqual(state.ioRecognitionBeat?.packetOutcome, "sealed", "cue reflects newest beat");
}

export function runIoRecognitionCueContractChecks(): void {
  checkOpenBeatPublishesCueWithFrozenShape();
  checkOpenBeatCarriesSealedOutcomeThrough();
  checkCueShapeHasNoUnexpectedFields();
  checkPublishVersionMonotonicPerBeat();
}

// No top-level call — the CI-gating INVOCATION lives in the paired
// Playwright spec `aftersign/e2e/io-recognition-cue-contract.spec.ts`
// so the aftersign lane actually runs the checks under
// `test:e2e:aftersign`.
