// Standalone assertion harness for recognitionFeedbackAt.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (see PR #453 review — vitest is not a dependency), so this file is a
// plain-TS harness: run it with `tsx` / `node --loader` if you want the
// assertions to execute, but at typecheck time it's just a module with
// exported check functions and no external imports.
import {
  IO_RECOGNITION_BEAT_MS,
  RECOGNITION_FEEDBACK_TOTAL_MS,
  recognitionDialogueAt,
  recognitionDialogueForBeat,
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

// Envelope guardrail for feel regressions: push-in should only ramp up
// until the remember peak, then only decay through settle.
export function checkCameraPushEnvelopeMonotonic(): void {
  const stepMs = 20;
  const epsilon = 0.0001;

  let previous = recognitionFeedbackAt(0).cameraPushDegrees;
  for (let t = stepMs; t <= 700; t += stepMs) {
    const current = recognitionFeedbackAt(t).cameraPushDegrees;
    assert(
      current + epsilon >= previous,
      `cameraPushDegrees should be non-decreasing to peak (t=${t}): prev=${previous}, current=${current}`,
    );
    previous = current;
  }

  for (let t = 700 + stepMs; t <= RECOGNITION_FEEDBACK_TOTAL_MS; t += stepMs) {
    const current = recognitionFeedbackAt(t).cameraPushDegrees;
    assert(
      current <= previous + epsilon,
      `cameraPushDegrees should be non-increasing after peak (t=${t}): prev=${previous}, current=${current}`,
    );
    previous = current;
  }
}

// Subtitle feel guardrail: scale should stay in a tight readability band
// through the full recognition beat and return to 1.0 at the end.
export function checkSubtitleScaleEnvelopeBounds(): void {
  const stepMs = 20;
  const epsilon = 0.0001;

  for (let t = 0; t <= RECOGNITION_FEEDBACK_TOTAL_MS; t += stepMs) {
    const state = recognitionFeedbackAt(t);
    assert(
      state.subtitleScale >= 1 - epsilon,
      `subtitleScale should never dip below 1.0 (t=${t}): got ${state.subtitleScale}`,
    );
    assert(
      state.subtitleScale <= 1.06 + epsilon,
      `subtitleScale should stay within readability cap (t=${t}): got ${state.subtitleScale}`,
    );
  }

  const endState = recognitionFeedbackAt(RECOGNITION_FEEDBACK_TOTAL_MS);
  assertClose(endState.subtitleScale, 1, 0.01, 't=end subtitleScale reset');
}

export function checkRecognitionDialogueTimeline(): void {
  assert(recognitionDialogueAt(0, 'sealed') === null, 'dialogue should be null before first beat');

  const sealedBeat0 = recognitionDialogueAt(440, 'sealed');
  assert(sealedBeat0 !== null, 'sealed beat 0 should exist at 440ms');
  assert(
    sealedBeat0?.lineId === 'io_return_packet_sealed',
    `sealed beat lineId mismatch: got '${sealedBeat0?.lineId}'`,
  );
  assert(
    sealedBeat0?.text === 'You brought it back sealed.',
    `sealed beat 0 text mismatch: got '${sealedBeat0?.text}'`,
  );

  const openedBeat1 = recognitionDialogueAt(880, 'opened');
  assert(openedBeat1 !== null, 'opened beat 1 should exist at 880ms');
  assert(
    openedBeat1?.text === 'You still choose truth over tidy.',
    `opened beat 1 text mismatch: got '${openedBeat1?.text}'`,
  );

  const openedBeat2 = recognitionDialogueAt(RECOGNITION_FEEDBACK_TOTAL_MS, 'opened');
  assert(openedBeat2 !== null, 'opened beat 2 should exist at end of beat');
  assert(
    openedBeat2?.text === 'I remember that kind of courage.',
    `opened beat 2 text mismatch: got '${openedBeat2?.text}'`,
  );
  assertClose(
    openedBeat2?.triggerMs ?? -1,
    IO_RECOGNITION_BEAT_MS[2],
    0,
    'beat 2 trigger time should match constant',
  );
}

export function checkRecognitionDialogueForBeatContract(): void {
  const sealed = recognitionDialogueForBeat('sealed', 2);
  assert(
    sealed.text === 'I remember that kind of care.',
    `sealed beat 2 text mismatch: got '${sealed.text}'`,
  );
  assert(sealed.lineId === 'io_return_packet_sealed', `sealed lineId mismatch: got '${sealed.lineId}'`);

  const opened = recognitionDialogueForBeat('opened', 0);
  assert(
    opened.text === 'You opened it before you came.',
    `opened beat 0 text mismatch: got '${opened.text}'`,
  );
  assert(opened.lineId === 'io_return_packet_opened', `opened lineId mismatch: got '${opened.lineId}'`);
}

export function runRecognitionFeedbackChecks(): void {
  checkCatchBeatOpensRecognition();
  checkRememberBloomThenSettle();
  checkPhaseBoundariesAreContinuous();
  checkRecognitionProfileContract();
  checkCameraPushEnvelopeMonotonic();
  checkSubtitleScaleEnvelopeBounds();
  checkRecognitionDialogueTimeline();
  checkRecognitionDialogueForBeatContract();
}
