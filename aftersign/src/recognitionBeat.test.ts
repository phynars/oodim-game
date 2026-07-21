// Standalone assertion harness for `ioRecognitionBeat` and
// `recognitionBeatProgress` in `./recognitionBeat.ts`.
//
// Convention: this package has NO test runner (vitest is not a repo
// dependency — see `aftersign/README.md` and root `package.json`). Every
// sibling `aftersign/src/*.test.ts` is a plain-TS module that `throw`s
// on failure and exports a `run*Checks()` entry. `tsc --noEmit` under
// `typecheck:aftersign` compiles this file; execution is opt-in via
// `tsx` or the harness entry.
//
// If you're tempted to `import { describe, expect, it } from "vitest"`:
// STOP. That will fail TS2307 in CI. Use the throw-asserts below.

import {
  ioRecognitionBeat,
  recognitionBeatProgress,
  recognitionFeedbackContract,
} from "./recognitionBeat";
import { ioReturningSessionLines } from "../../packages/aftersign/src/ioReturningSession";

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

function assertClose(
  actual: number,
  expected: number,
  epsilon: number,
  label: string,
): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new AssertionError(
      `${label}: expected ≈ ${expected}, got ${actual} (ε=${epsilon})`,
    );
  }
}

// ---------------------------------------------------------------------------
// ioRecognitionBeat — memory line resolver
// ---------------------------------------------------------------------------

export function checkSealedListenedLineMatchesCanonical(): void {
  const beat = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true });

  assertEqual(beat.outcome, "sealed", "sealed+listened outcome");
  assertEqual(
    beat.line,
    ioReturningSessionLines.sealedPacketListenedRoute,
    "sealed+listened line text (must be sourced from ioReturningSessionLines, not composed)",
  );
  assertEqual(
    beat.lineId,
    "io.recognition.returning.sealed.listened.v1",
    "sealed+listened lineId",
  );
}

export function checkSealedSkippedLineMatchesCanonical(): void {
  const beat = ioRecognitionBeat({ outcome: "sealed", listenedToRoute: false });

  assertEqual(beat.outcome, "sealed", "sealed+skipped outcome");
  assertEqual(
    beat.line,
    ioReturningSessionLines.sealedPacketSkippedRoute,
    "sealed+skipped line text (must be sourced from ioReturningSessionLines, not composed)",
  );
  assertEqual(
    beat.lineId,
    "io.recognition.returning.sealed.skipped.v1",
    "sealed+skipped lineId",
  );
}

export function checkOpenedListenedLineMatchesCanonical(): void {
  const beat = ioRecognitionBeat({ outcome: "opened", listenedToRoute: true });

  assertEqual(beat.outcome, "opened", "opened+listened outcome");
  assertEqual(
    beat.line,
    ioReturningSessionLines.openedPacketListenedRoute,
    "opened+listened line text (must be sourced from ioReturningSessionLines, not composed)",
  );
  assertEqual(
    beat.lineId,
    "io.recognition.returning.opened.listened.v1",
    "opened+listened lineId",
  );
}

export function checkOpenedSkippedLineMatchesCanonical(): void {
  const beat = ioRecognitionBeat({ outcome: "opened", listenedToRoute: false });

  assertEqual(beat.outcome, "opened", "opened+skipped outcome");
  assertEqual(
    beat.line,
    ioReturningSessionLines.openedPacketSkippedRoute,
    "opened+skipped line text (must be sourced from ioReturningSessionLines, not composed)",
  );
  assertEqual(
    beat.lineId,
    "io.recognition.returning.opened.skipped.v1",
    "opened+skipped lineId",
  );
}

export function checkAllFourLineIdsAreDistinct(): void {
  const ids = new Set([
    ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true }).lineId,
    ioRecognitionBeat({ outcome: "sealed", listenedToRoute: false }).lineId,
    ioRecognitionBeat({ outcome: "opened", listenedToRoute: true }).lineId,
    ioRecognitionBeat({ outcome: "opened", listenedToRoute: false }).lineId,
  ]);

  assertEqual(ids.size, 4, "distinct lineIds across outcome × listened");
}

export function checkAllFourLinesAreDistinct(): void {
  const lines = new Set([
    ioRecognitionBeat({ outcome: "sealed", listenedToRoute: true }).line,
    ioRecognitionBeat({ outcome: "sealed", listenedToRoute: false }).line,
    ioRecognitionBeat({ outcome: "opened", listenedToRoute: true }).line,
    ioRecognitionBeat({ outcome: "opened", listenedToRoute: false }).line,
  ]);

  assertEqual(lines.size, 4, "distinct line strings across outcome × listened");
}

// ---------------------------------------------------------------------------
// recognitionBeatProgress — thin delegate over the live contract
// ---------------------------------------------------------------------------

export function checkBeatStartsAtRest(): void {
  const start = recognitionBeatProgress(0);

  assertClose(start.cameraDeltaMeters, 0, 0.001, "t=0 cameraDeltaMeters");
  assertClose(start.cameraYawDegrees, 0, 0.001, "t=0 cameraYawDegrees");
  assert(start.stingGainDb === null, "t=0 stingGainDb should be null");
  assertClose(start.progress, 0, 0.001, "t=0 progress");
}

export function checkCameraPeaksAtContractPeakMs(): void {
  const peak = recognitionBeatProgress(recognitionFeedbackContract.cameraPeakMs, {
    outcome: "sealed",
  });

  assertClose(
    peak.cameraDeltaMeters,
    recognitionFeedbackContract.cameraDeltaMeters,
    1e-6,
    "peak cameraDeltaMeters matches contract",
  );
  assertClose(
    peak.cameraYawDegrees,
    recognitionFeedbackContract.cameraYawDegrees,
    1e-6,
    "peak cameraYawDegrees matches contract",
  );
}

export function checkReducedMotionSuppressesCamera(): void {
  const reduced = recognitionBeatProgress(80, {
    reducedMotion: true,
    outcome: "sealed",
  });

  assertClose(reduced.cameraDeltaMeters, 0, 0.001, "reduced cameraDeltaMeters");
  assertClose(reduced.cameraYawDegrees, 0, 0.001, "reduced cameraYawDegrees");
  assertEqual(
    reduced.totalMs,
    recognitionFeedbackContract.reducedMotionTotalMs,
    "reduced totalMs matches contract",
  );
}

export function checkOutcomeBranchCuesArePresent(): void {
  const sample = recognitionBeatProgress(200, { outcome: "opened" });

  assert(sample.lantern !== undefined, "lantern cue should be defined");
  assert(sample.packetSeal !== undefined, "packetSeal cue should be defined");
  assert(sample.kioskSign !== undefined, "kioskSign cue should be defined");
  assert(sample.rainRim !== undefined, "rainRim cue should be defined");
  assert(sample.hapticScale !== undefined, "hapticScale should be defined");
  assert(
    sample.audioCueIds.includes("recognition-sting"),
    "audioCueIds should include recognition-sting",
  );
}

export function checkOpenedWoodenClickTimingComesFromContract(): void {
  const stingStart = recognitionFeedbackContract.stingStartMs;
  const clickDelay = recognitionFeedbackContract.openedWoodenClickDelayMs;
  const opened = recognitionBeatProgress(stingStart + clickDelay + 5, {
    outcome: "opened",
  });

  assert(
    opened.woodenClickElapsedMs !== null,
    "opened woodenClickElapsedMs should be non-null past stingStart+clickDelay",
  );
  assert(
    (opened.woodenClickElapsedMs ?? -1) >= 0,
    "opened woodenClickElapsedMs should be >= 0",
  );
}

export function checkBeatSettlesAtEnd(): void {
  const settled = recognitionBeatProgress(
    recognitionFeedbackContract.totalMs + 500,
  );

  // elapsedMs is clamped to totalMs by the sampler → progress fully home,
  // sting has expired (null), and the beat has an endedAt timestamp.
  assertClose(settled.progress, 1, 0.001, "settled progress");
  assertEqual(
    settled.elapsedMs,
    recognitionFeedbackContract.totalMs,
    "settled elapsedMs is clamped to totalMs",
  );
  assert(settled.stingGainDb === null, "settled stingGainDb should be null");
  assert(settled.endedAt !== null, "settled endedAt should be non-null");
}

export function runRecognitionBeatChecks(): void {
  checkSealedListenedLineMatchesCanonical();
  checkSealedSkippedLineMatchesCanonical();
  checkOpenedListenedLineMatchesCanonical();
  checkOpenedSkippedLineMatchesCanonical();
  checkAllFourLineIdsAreDistinct();
  checkAllFourLinesAreDistinct();
  checkBeatStartsAtRest();
  checkCameraPeaksAtContractPeakMs();
  checkReducedMotionSuppressesCamera();
  checkOutcomeBranchCuesArePresent();
  checkOpenedWoodenClickTimingComesFromContract();
  checkBeatSettlesAtEnd();
}

// Deliberately no top-level `runRecognitionBeatChecks()` call here.
//
// Convention (see `aftersign/src/feel/firstCameraMove.test.ts` +
// `aftersign/src/packetIntent.test.ts` + `aftersign/e2e/packet-intent-contract.spec.ts`):
// the CI-gating INVOCATION lives in a Playwright spec under `aftersign/e2e/`
// so `test:e2e:aftersign` actually runs the checks. Wrapping `runRecognitionBeatChecks()`
// inside a spec's `expect(() => …).not.toThrow()` gives:
//   • one clear failure message with a stack trace in the Playwright report
//     when an invariant regresses,
//   • idempotent execution under the aftersign lane's `retries: 3` cold-start
//     policy (see `aftersign/playwright.config.ts`), because the checks read
//     only pure functions with no page fixture,
//   • no double-execution when a future e2e spec imports symbols from this
//     module — a bare bottom-level call would fire at import time and re-run
//     under the harness spec.
// The paired spec is `aftersign/e2e/recognition-beat-contract.spec.ts`.
