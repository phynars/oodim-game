// Standalone assertion harness for recognitionFeedbackAt.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (see PR #453 review — vitest is not a dependency), so this file is a
// plain-TS harness: run it with `tsx` / `node --loader` if you want the
// assertions to execute, but at typecheck time it's just a module with
// exported check functions and no external imports.
import {
  RECOGNITION_FEEDBACK_TOTAL_MS,
  recognitionFeedbackAt,
} from './recognitionFeedback';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function assertClose(actual: number, expected: number, epsilon: number, label: string): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new AssertionError(`${label}: expected ≈ ${expected}, got ${actual} (ε=${epsilon})`);
  }
}

export function checkCatchBeatOpensRecognition(): void {
  const start = recognitionFeedbackAt(0);
  assert(start.phase === 'catch', `t=0 phase: expected 'catch', got '${start.phase}'`);
  assertClose(start.screenShakePx, 1.5, 0.01, 't=0 screenShakePx');
  assertClose(start.cameraPushDegrees, 0, 0.01, 't=0 cameraPushDegrees');
  assertClose(start.subtitleScale, 1, 0.01, 't=0 subtitleScale');

  const rememberStart = recognitionFeedbackAt(180);
  assert(
    rememberStart.phase === 'remember',
    `t=180 phase: expected 'remember', got '${rememberStart.phase}'`,
  );
  assert(
    rememberStart.audioCue === 'memory-chime',
    `t=180 audioCue: expected 'memory-chime', got '${rememberStart.audioCue}'`,
  );
}

export function checkRememberBloomThenSettle(): void {
  const bloom = recognitionFeedbackAt(520);
  assert(bloom.phase === 'remember', `t=520 phase: expected 'remember', got '${bloom.phase}'`);
  assert(
    bloom.cameraPushDegrees > 2.5,
    `t=520 cameraPushDegrees: expected > 2.5, got ${bloom.cameraPushDegrees}`,
  );
  assert(
    bloom.vignetteOpacity > 0.24,
    `t=520 vignetteOpacity: expected > 0.24, got ${bloom.vignetteOpacity}`,
  );
  assert(
    bloom.subtitleScale > 1.04,
    `t=520 subtitleScale: expected > 1.04, got ${bloom.subtitleScale}`,
  );

  const done = recognitionFeedbackAt(RECOGNITION_FEEDBACK_TOTAL_MS);
  assert(done.phase === 'settle', `t=end phase: expected 'settle', got '${done.phase}'`);
  assertClose(done.cameraPushDegrees, 0, 0.01, 't=end cameraPushDegrees');
  assertClose(done.vignetteOpacity, 0, 0.01, 't=end vignetteOpacity');
  assert(
    done.audioCue === 'room-tone',
    `t=end audioCue: expected 'room-tone', got '${done.audioCue}'`,
  );
}

// Boundary-continuity checks — the whole point of PR #453's feel-curve work.
export function checkPhaseBoundariesAreContinuous(): void {
  const epsilon = 0.03;
  const beforeCatchEnd = recognitionFeedbackAt(179);
  const atRememberStart = recognitionFeedbackAt(180);
  assertClose(
    beforeCatchEnd.cameraPushDegrees,
    atRememberStart.cameraPushDegrees,
    epsilon,
    't=180 cameraPushDegrees continuity',
  );
  assertClose(
    beforeCatchEnd.vignetteOpacity,
    atRememberStart.vignetteOpacity,
    epsilon,
    't=180 vignetteOpacity continuity',
  );

  const beforeRememberEnd = recognitionFeedbackAt(699);
  const atSettleStart = recognitionFeedbackAt(700);
  assertClose(
    beforeRememberEnd.cameraPushDegrees,
    atSettleStart.cameraPushDegrees,
    epsilon,
    't=700 cameraPushDegrees continuity',
  );
  assertClose(
    beforeRememberEnd.vignetteOpacity,
    atSettleStart.vignetteOpacity,
    epsilon,
    't=700 vignetteOpacity continuity',
  );
}

export function checkRecognitionProfileContract(): void {
  assert(
    RECOGNITION_FEEDBACK_TOTAL_MS === 1220,
    `total duration: expected 1220ms, got ${RECOGNITION_FEEDBACK_TOTAL_MS}ms`,
  );

  const peak = recognitionFeedbackAt(700);
  assertClose(peak.cameraPushDegrees, 4, 0.01, 't=700 cameraPushDegrees peak');
  assertClose(peak.vignetteOpacity, 0.32, 0.01, 't=700 vignette peak');
}

export function runRecognitionFeedbackChecks(): void {
  checkCatchBeatOpensRecognition();
  checkRememberBloomThenSettle();
  checkPhaseBoundariesAreContinuous();
  checkRecognitionProfileContract();
}
