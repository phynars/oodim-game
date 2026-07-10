// Standalone assertion harness for recognitionFeedbackAt.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (see PR #453 review — vitest is not a dependency), so this file is a
// plain-TS harness: run it with `tsx` / `node --loader` if you want the
// assertions to execute, but at typecheck time it's just a module with
// exported check functions and no external imports.
import {
  IO_RECOGNITION_BEAT_MS,
  RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
  RECOGNITION_FEEDBACK_GLOW_FROM,
  RECOGNITION_FEEDBACK_GLOW_TO,
  RECOGNITION_FEEDBACK_OPENED_TARGET_OFFSET_METERS,
  RECOGNITION_FEEDBACK_REDUCED_MOTION_MS,
  RECOGNITION_FEEDBACK_STING_DURATION_MS,
  RECOGNITION_FEEDBACK_STING_GAIN_DB,
  RECOGNITION_FEEDBACK_STING_START_MS,
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
  assertClose(start.cameraYawDegrees, 0, 0.01, 't=0 cameraYawDegrees');
  assertClose(start.cameraDeltaMeters, 0, 0.01, 't=0 cameraDeltaMeters');
  assertClose(start.subtitleScale, 1, 0.01, 't=0 subtitleScale');
  assert(start.outcome === 'sealed', `default outcome: expected sealed, got ${start.outcome}`);

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
    bloom.cameraDeltaMeters > 0.2,
    `t=520 cameraDeltaMeters: expected > 0.2, got ${bloom.cameraDeltaMeters}`,
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
  assertClose(done.cameraDeltaMeters, 0, 0.01, 't=end cameraDeltaMeters');
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
    beforeCatchEnd.cameraDeltaMeters,
    atRememberStart.cameraDeltaMeters,
    epsilon,
    't=180 cameraDeltaMeters continuity',
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
    beforeRememberEnd.cameraDeltaMeters,
    atSettleStart.cameraDeltaMeters,
    epsilon,
    't=700 cameraDeltaMeters continuity',
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
  assertClose(peak.cameraYawDegrees, RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES, 0.01, 't=700 cameraYawDegrees peak');
  assertClose(peak.cameraPushDegrees, 4, 0.01, 't=700 cameraPushDegrees peak');
  assertClose(peak.cameraDeltaMeters, RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS, 0.01, 't=700 cameraDeltaMeters peak');
  assertClose(peak.vignetteOpacity, 0.32, 0.01, 't=700 vignette peak');
}

export function checkRecognitionSpecBands(): void {
  assert(
    RECOGNITION_FEEDBACK_TOTAL_MS >= 1100 && RECOGNITION_FEEDBACK_TOTAL_MS <= 1350,
    `total duration should be in 1,100–1,350ms harness window, got ${RECOGNITION_FEEDBACK_TOTAL_MS}`,
  );

  const peak = recognitionFeedbackAt(700, { outcome: 'sealed' });
  assert(
    peak.cameraDeltaMeters >= 0.24 && peak.cameraDeltaMeters <= 0.36,
    `peak cameraDeltaMeters should be 0.24–0.36m, got ${peak.cameraDeltaMeters}`,
  );
  assert(
    peak.cameraYawDegrees >= 3 && peak.cameraYawDegrees <= 5,
    `peak cameraYawDegrees should be 3–5°, got ${peak.cameraYawDegrees}`,
  );
}

export function checkSignGlowAndStingTiming(): void {
  const beforeGlow = recognitionFeedbackAt(79);
  assertClose(beforeGlow.signEmissiveScale, RECOGNITION_FEEDBACK_GLOW_FROM, 0.01, 't=79 signEmissiveScale');

  const glowDone = recognitionFeedbackAt(220);
  assertClose(glowDone.signEmissiveScale, RECOGNITION_FEEDBACK_GLOW_TO, 0.01, 't=220 signEmissiveScale');

  const sting = recognitionFeedbackAt(RECOGNITION_FEEDBACK_STING_START_MS);
  assert(sting.audioCue === 'bell-glass-sting', `sting cue mismatch: got ${sting.audioCue}`);
  assert(sting.audioCueStarted, 'sting should be marked started at 120ms');
  assertClose(sting.audioCueDurationMs, RECOGNITION_FEEDBACK_STING_DURATION_MS, 0, 'sting duration');
  assertClose(sting.audioCueGainDb, RECOGNITION_FEEDBACK_STING_GAIN_DB, 0, 'sting gain');
}

export function checkOutcomeBranchDeltas(): void {
  const sealed = recognitionFeedbackAt(700, { outcome: 'sealed' });
  const opened = recognitionFeedbackAt(700, { outcome: 'opened' });
  assert(sealed.branchTint === 'blue', `sealed tint: expected blue, got ${sealed.branchTint}`);
  assert(opened.branchTint === 'amber', `opened tint: expected amber, got ${opened.branchTint}`);
  assertClose(sealed.cameraTargetOffsetMeters, 0, 0.001, 'sealed cameraTargetOffsetMeters');
  assertClose(
    opened.cameraTargetOffsetMeters,
    RECOGNITION_FEEDBACK_OPENED_TARGET_OFFSET_METERS,
    0.001,
    'opened cameraTargetOffsetMeters',
  );

  const openedClick = recognitionFeedbackAt(RECOGNITION_FEEDBACK_STING_START_MS + 45, { outcome: 'opened' });
  assert(openedClick.audioCue === 'wooden-click', `opened click cue mismatch: got ${openedClick.audioCue}`);
}

export function checkReducedMotionFallback(): void {
  const midPulse = recognitionFeedbackAt(80, { reducedMotion: true });
  assert(midPulse.reducedMotion, 'reduced-motion state should report reducedMotion=true');
  assertClose(midPulse.cameraDeltaMeters, 0, 0.001, 'reduced cameraDeltaMeters');
  assertClose(midPulse.cameraYawDegrees, 0, 0.001, 'reduced cameraYawDegrees');
  assert(midPulse.signEmissiveScale > 1, `reduced pulse should raise signEmissiveScale, got ${midPulse.signEmissiveScale}`);

  const done = recognitionFeedbackAt(RECOGNITION_FEEDBACK_REDUCED_MOTION_MS, { reducedMotion: true });
  assert(done.phase === 'settle', `reduced t=end phase: expected settle, got ${done.phase}`);
  assertClose(done.signEmissiveScale, RECOGNITION_FEEDBACK_GLOW_TO, 0.01, 'reduced t=end signEmissiveScale');
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
  checkRecognitionSpecBands();
  checkSignGlowAndStingTiming();
  checkOutcomeBranchDeltas();
  checkReducedMotionFallback();
  checkCameraPushEnvelopeMonotonic();
  checkSubtitleScaleEnvelopeBounds();
  checkRecognitionDialogueTimeline();
  checkRecognitionDialogueForBeatContract();
}

runRecognitionFeedbackChecks();
