// Feel contract for Io's returning-session recognition beat.
//
// This module DOES NOT invent numbers. It re-exports the live constants
// from `./recognitionFeedback.ts` as a single frozen contract object, so
// there is only one source of truth. If the live constants change, this
// contract changes with them — the reconciliation test in
// `./ioReturningRecognitionFeel.test.ts` fails loudly if any human ever
// hardcodes a drift here.
//
// See PR #629 review — the prior draft of this file was a plain-JS
// file with fabricated numbers that contradicted the live implementation
// (cameraDollyZ -0.42 vs live 0.32, cameraYawDeg 2.5 vs live 4,
// memoryLineDelayMs 520 vs live beats [440, 880, 1220]). This version
// is wired to the live constants so drift is impossible by construction.

import {
  IO_RECOGNITION_BEAT_MS,
  RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
  RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
  RECOGNITION_FEEDBACK_STING_DURATION_MS,
  RECOGNITION_FEEDBACK_STING_GAIN_DB,
  RECOGNITION_FEEDBACK_STING_START_MS,
  RECOGNITION_FEEDBACK_TOTAL_MS,
  recognitionFeedbackAt,
  type IoRecognitionOutcome,
  type RecognitionFeedbackState,
} from './recognitionFeedback';

export type IoReturningRecognitionFeel = {
  readonly beat: 'io_returning_recognition';
  /** Total recognition-beat window in milliseconds. */
  readonly totalMs: number;
  /** Reduced-motion fallback window in milliseconds. */
  readonly reducedMotionMs: number;
  /** Peak camera dolly delta in world meters (signed by phase direction). */
  readonly cameraDeltaMeters: number;
  /** Peak camera yaw in degrees. */
  readonly cameraYawDegrees: number;
  /** Sting cue start / duration / gain — audio-visual coupling window. */
  readonly stingStartMs: number;
  readonly stingDurationMs: number;
  readonly stingGainDb: number;
  /** Memory-line trigger times, in milliseconds from beat start. */
  readonly memoryBeatTriggerMs: readonly [number, number, number];
};

/**
 * The live contract, derived directly from `recognitionFeedback.ts`.
 * Freezing prevents accidental mutation by consumers.
 */
export const IO_RETURNING_RECOGNITION_FEEL: IoReturningRecognitionFeel = Object.freeze({
  beat: 'io_returning_recognition' as const,
  totalMs: RECOGNITION_FEEDBACK_TOTAL_MS,
  reducedMotionMs: RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
  cameraDeltaMeters: RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  cameraYawDegrees: RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
  stingStartMs: RECOGNITION_FEEDBACK_STING_START_MS,
  stingDurationMs: RECOGNITION_FEEDBACK_STING_DURATION_MS,
  stingGainDb: RECOGNITION_FEEDBACK_STING_GAIN_DB,
  memoryBeatTriggerMs: [
    IO_RECOGNITION_BEAT_MS[0],
    IO_RECOGNITION_BEAT_MS[1],
    IO_RECOGNITION_BEAT_MS[2],
  ] as const,
});

export type IoReturningRecognitionFeelOptions = {
  readonly reducedMotion?: boolean;
};

/**
 * Returns the recognition feel contract. In reduced-motion mode, the
 * camera and dolly are zeroed and the total window collapses to the
 * reduced-motion pulse duration (matches `recognitionFeedbackAt`).
 */
export function getIoReturningRecognitionFeel(
  options: IoReturningRecognitionFeelOptions = {},
): IoReturningRecognitionFeel {
  if (options.reducedMotion) {
    return Object.freeze({
      ...IO_RETURNING_RECOGNITION_FEEL,
      totalMs: RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
      cameraDeltaMeters: 0,
      cameraYawDegrees: 0,
    });
  }
  return IO_RETURNING_RECOGNITION_FEEL;
}

/**
 * Assert that a live recognition state at the remember-peak (t≈700ms)
 * matches the contract within tolerance. Returns an array of failure
 * messages — empty if the state satisfies the contract.
 *
 * This is a bounds check, not a strict equality check, because the live
 * curve interpolates and small numerical drift is expected at any given
 * frame; the peak is the honest checkpoint (see
 * `checkRecognitionProfileContract` in `recognitionFeedback.test.ts`).
 */
export function assertIoReturningRecognitionFeel(
  peakState: RecognitionFeedbackState,
  contract: IoReturningRecognitionFeel = IO_RETURNING_RECOGNITION_FEEL,
): readonly string[] {
  const failures: string[] = [];
  const epsilon = 0.01;

  if (Math.abs(peakState.cameraDeltaMeters - contract.cameraDeltaMeters) > epsilon) {
    failures.push(
      `cameraDeltaMeters at peak: expected ${contract.cameraDeltaMeters}, got ${peakState.cameraDeltaMeters}`,
    );
  }
  if (Math.abs(peakState.cameraYawDegrees - contract.cameraYawDegrees) > epsilon) {
    failures.push(
      `cameraYawDegrees at peak: expected ${contract.cameraYawDegrees}, got ${peakState.cameraYawDegrees}`,
    );
  }
  if (peakState.reducedMotion) {
    failures.push('assertIoReturningRecognitionFeel expects a full-motion peak state, got reducedMotion=true');
  }

  return failures;
}

/**
 * Convenience helper the harness uses: fetch the live remember-peak state
 * and assert it against the contract. Keeps the assert function reachable
 * from a real caller so it isn't dead code.
 */
export function assertLiveRecognitionMatchesContract(
  outcome: IoRecognitionOutcome = 'sealed',
): readonly string[] {
  const peakState = recognitionFeedbackAt(700, { outcome });
  return assertIoReturningRecognitionFeel(peakState);
}
