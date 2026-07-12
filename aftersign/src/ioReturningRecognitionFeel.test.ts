// Assertion harness for the Io returning-recognition feel contract.
//
// Same convention as `recognitionFeedback.test.ts`: plain-TS
// `throw`-on-failure asserts, no vitest. Run with tsx if you want the
// assertions to execute; typecheck alone confirms shape + imports.

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
} from './recognitionFeedback';
import {
  IO_RETURNING_RECOGNITION_FEEL,
  assertIoReturningRecognitionFeel,
  assertLiveRecognitionMatchesContract,
  getIoReturningRecognitionFeel,
} from './ioReturningRecognitionFeel';

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

// The whole point of PR #629 review — the contract numbers MUST match
// the live implementation's exported constants. If a human hardcodes a
// drift into either file, this fails immediately.
export function checkContractReconcilesWithLiveConstants(): void {
  assert(
    IO_RETURNING_RECOGNITION_FEEL.totalMs === RECOGNITION_FEEDBACK_TOTAL_MS,
    `totalMs drift: contract=${IO_RETURNING_RECOGNITION_FEEL.totalMs} live=${RECOGNITION_FEEDBACK_TOTAL_MS}`,
  );
  assert(
    IO_RETURNING_RECOGNITION_FEEL.reducedMotionMs === RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
    `reducedMotionMs drift: contract=${IO_RETURNING_RECOGNITION_FEEL.reducedMotionMs} live=${RECOGNITION_FEEDBACK_REDUCED_MOTION_MS}`,
  );
  assert(
    IO_RETURNING_RECOGNITION_FEEL.cameraDeltaMeters === RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
    `cameraDeltaMeters drift: contract=${IO_RETURNING_RECOGNITION_FEEL.cameraDeltaMeters} live=${RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS}`,
  );
  assert(
    IO_RETURNING_RECOGNITION_FEEL.cameraYawDegrees === RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
    `cameraYawDegrees drift: contract=${IO_RETURNING_RECOGNITION_FEEL.cameraYawDegrees} live=${RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES}`,
  );
  assert(
    IO_RETURNING_RECOGNITION_FEEL.stingStartMs === RECOGNITION_FEEDBACK_STING_START_MS,
    `stingStartMs drift: contract=${IO_RETURNING_RECOGNITION_FEEL.stingStartMs} live=${RECOGNITION_FEEDBACK_STING_START_MS}`,
  );
  assert(
    IO_RETURNING_RECOGNITION_FEEL.stingDurationMs === RECOGNITION_FEEDBACK_STING_DURATION_MS,
    `stingDurationMs drift: contract=${IO_RETURNING_RECOGNITION_FEEL.stingDurationMs} live=${RECOGNITION_FEEDBACK_STING_DURATION_MS}`,
  );
  assert(
    IO_RETURNING_RECOGNITION_FEEL.stingGainDb === RECOGNITION_FEEDBACK_STING_GAIN_DB,
    `stingGainDb drift: contract=${IO_RETURNING_RECOGNITION_FEEL.stingGainDb} live=${RECOGNITION_FEEDBACK_STING_GAIN_DB}`,
  );

  for (let i = 0; i < 3; i += 1) {
    assert(
      IO_RETURNING_RECOGNITION_FEEL.memoryBeatTriggerMs[i] === IO_RECOGNITION_BEAT_MS[i],
      `memoryBeatTriggerMs[${i}] drift: contract=${IO_RETURNING_RECOGNITION_FEEL.memoryBeatTriggerMs[i]} live=${IO_RECOGNITION_BEAT_MS[i]}`,
    );
  }
}

export function checkAssertPassesOnLivePeakState(): void {
  const failures = assertLiveRecognitionMatchesContract('sealed');
  assert(
    failures.length === 0,
    `assertLiveRecognitionMatchesContract should pass on live peak state, got failures:\n${failures.join('\n')}`,
  );

  const openedFailures = assertLiveRecognitionMatchesContract('opened');
  assert(
    openedFailures.length === 0,
    `assertLiveRecognitionMatchesContract should pass for opened branch too, got failures:\n${openedFailures.join('\n')}`,
  );
}

export function checkAssertFailsOnDriftedState(): void {
  const livePeak = recognitionFeedbackAt(700);
  const driftedPeak = {
    ...livePeak,
    cameraYawDegrees: 2.5, // the number from the rejected PR draft
    cameraDeltaMeters: -0.42, // ditto
  };
  const failures = assertIoReturningRecognitionFeel(driftedPeak);
  assert(
    failures.length >= 2,
    `assertIoReturningRecognitionFeel should flag both camera drifts, got: ${JSON.stringify(failures)}`,
  );
  assert(
    failures.some((f) => f.includes('cameraYawDegrees')),
    `assert should mention cameraYawDegrees drift, got: ${JSON.stringify(failures)}`,
  );
  assert(
    failures.some((f) => f.includes('cameraDeltaMeters')),
    `assert should mention cameraDeltaMeters drift, got: ${JSON.stringify(failures)}`,
  );
}

export function checkReducedMotionContractCollapsesCamera(): void {
  const contract = getIoReturningRecognitionFeel({ reducedMotion: true });
  assert(contract.cameraDeltaMeters === 0, `reduced-motion cameraDeltaMeters: expected 0, got ${contract.cameraDeltaMeters}`);
  assert(contract.cameraYawDegrees === 0, `reduced-motion cameraYawDegrees: expected 0, got ${contract.cameraYawDegrees}`);
  assert(
    contract.totalMs === RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
    `reduced-motion totalMs: expected ${RECOGNITION_FEEDBACK_REDUCED_MOTION_MS}, got ${contract.totalMs}`,
  );

  const defaultContract = getIoReturningRecognitionFeel();
  assert(
    defaultContract === IO_RETURNING_RECOGNITION_FEEL,
    'default getIoReturningRecognitionFeel() should return the shared frozen contract',
  );
}

export function checkContractIsFrozen(): void {
  assert(Object.isFrozen(IO_RETURNING_RECOGNITION_FEEL), 'IO_RETURNING_RECOGNITION_FEEL must be frozen');
}

export function runIoReturningRecognitionFeelChecks(): void {
  checkContractReconcilesWithLiveConstants();
  checkAssertPassesOnLivePeakState();
  checkAssertFailsOnDriftedState();
  checkReducedMotionContractCollapsesCamera();
  checkContractIsFrozen();
}

runIoReturningRecognitionFeelChecks();
