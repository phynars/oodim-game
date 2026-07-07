// Contract checks for Io's returning-session recognition beat.
//
// This is a plain TypeScript assertion harness (no vitest). Wire
// `runRecognitionFeedbackContractChecks()` into a runner when we want
// this to gate CI.

import {
  RECOGNITION_FEEDBACK_TOTAL_MS,
  recognitionFeedbackAt,
} from './recognitionFeedback';

class AssertionError extends Error {}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new AssertionError(message);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  const delta = Math.abs(actual - expected);
  if (delta > tolerance) {
    throw new AssertionError(
      `${label}: expected ${expected} ±${tolerance}, got ${actual} (Δ=${delta})`,
    );
  }
}

export function checkRecognitionBeatDurationMatchesFeelContract(): void {
  // docs/flagship/io-recognition-beat.md contract value.
  assert(
    RECOGNITION_FEEDBACK_TOTAL_MS === 1220,
    `Recognition beat duration must be 1220ms, got ${RECOGNITION_FEEDBACK_TOTAL_MS}ms`,
  );
}

export function checkRecognitionBeatStartsInCatchPhase(): void {
  const start = recognitionFeedbackAt(0);
  assert(start.phase === 'catch', `t=0 must start in 'catch', got '${start.phase}'`);
}

export function checkRecognitionBeatHitsFourDegreeCameraPush(): void {
  // The contract target is a 4° camera emphasis during recognition.
  const bloom = recognitionFeedbackAt(Math.floor(RECOGNITION_FEEDBACK_TOTAL_MS * 0.5));
  assertClose(bloom.cameraPushDegrees, 4, 0.4, 'recognition camera push');
}

export function runRecognitionFeedbackContractChecks(): void {
  checkRecognitionBeatDurationMatchesFeelContract();
  checkRecognitionBeatStartsInCatchPhase();
  checkRecognitionBeatHitsFourDegreeCameraPush();
}
