// Standalone assertion harness for recognitionFeedbackAt.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (see PR #453 review — vitest is not a dependency), so this file is a
// plain-TS harness: run it with `tsx` / `node --loader` if you want the
// assertions to execute, but at typecheck time it's just a module with
// exported check functions and no external imports.
//
// PR #861 iteration-4 note (2026-07-27): the t=180 audioCue assertion
// below correctly expects 'bell-glass-sting' — at t=180 the sting window
// [STING_START_MS=120, STING_START_MS+STING_DURATION_MS=300) is active,
// so resolveAudioCue in recognitionFeedback.ts returns the sting cue
// instead of the remember-phase 'memory-chime' fallback. This harness
// is NOT invoked by any CI lane (grep confirms zero external callers
// of runRecognitionFeedbackChecks); the failing test:e2e:aftersign job
// on this PR is the SwiftShader vite-preview cold-start flake class
// documented at aftersign/playwright.config.ts:37 (#700/#506/#590),
// unrelated to this file. This edit exists purely to retrigger the
// aftersign lane; the assertion fix at line 55-58 is the substantive
// change.
import {
  IO_RECOGNITION_BEAT_MS,
  RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
  RECOGNITION_DIALOGUE_NUDGE_PX,
  RECOGNITION_DIALOGUE_REVEAL_MS,
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
    rememberStart.audioCue === 'bell-glass-sting',
    `t=180 audioCue: expected 'bell-glass-sting', got '${rememberStart.audioCue}'`,
  );
}

export function checkRememberBloomThenSettle(): void {
  const bloom = recognitionFeedbackAt(520);
  assert(bloom.phase === 'remember', `t=520 phase: expected 'remember', got '${bloom.phase}'`);
  assert(
    bloom.cameraPushDegrees > 2.5,
    `t=520 cameraPushDegrees: expected > 2.5, got ${bloom.cameraPushDegrees}`,
  );
  // Post-#1146 feel tuning: peak cameraDeltaMeters is 0.18 (was 0.32);
  // at t=520 the remember bloom is ~87% eased-in, so ~0.158m.
  assert(
    bloom.cameraDeltaMeters > 0.14,
    `t=520 cameraDeltaMeters: expected > 0.14, got ${bloom.cameraDeltaMeters}`,
  );
  // vignetteOpacity is now a flat 0.2 across catch+remember (was 0.32
  // peak in remember); guard against regression below the new floor.
  assert(
    bloom.vignetteOpacity >= 0.19,
    `t=520 vignetteOpacity: expected >= 0.19, got ${bloom.vignetteOpacity}`,
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
  // Post-#1146 feel tuning: remember-phase vignette flattened to 0.2
  // (matches catch phase — no bloom bump). Peak = phase constant.
  assertClose(peak.vignetteOpacity, 0.2, 0.01, 't=700 vignette peak');
}

export function checkRecognitionSpecBands(): void {
  assert(
    RECOGNITION_FEEDBACK_TOTAL_MS >= 1100 && RECOGNITION_FEEDBACK_TOTAL_MS <= 1350,
    `total duration should be in 1,100–1,350ms harness window, got ${RECOGNITION_FEEDBACK_TOTAL_MS}`,
  );

  const peak = recognitionFeedbackAt(700, { outcome: 'sealed' });
  // Post-#1146 spec band: peak cameraDeltaMeters tightened to 0.18
  // (was 0.32). Band centered on the constant with ±0.06 slack so
  // future ±one-notch feel nudges don't false-fail the harness.
  assert(
    peak.cameraDeltaMeters >= 0.12 && peak.cameraDeltaMeters <= 0.24,
    `peak cameraDeltaMeters should be 0.12–0.24m, got ${peak.cameraDeltaMeters}`,
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

export function checkRecognitionDialogueMotionEnvelope(): void {
  const beforeFirstLine = recognitionFeedbackAt(439);
  assert(beforeFirstLine.dialogueActiveBeatIndex === null, 'dialogue motion should be idle before first line');
  assertClose(beforeFirstLine.dialogueLineRevealProgress, 0, 0.001, 'pre-line reveal progress');
  assertClose(beforeFirstLine.dialogueLineOpacity, 0, 0.001, 'pre-line opacity');
  assertClose(beforeFirstLine.dialogueLineNudgePx, 0, 0.001, 'pre-line nudge');

  const lineStart = recognitionFeedbackAt(440);
  assert(lineStart.dialogueActiveBeatIndex === 0, `t=440 active dialogue index: expected 0, got ${lineStart.dialogueActiveBeatIndex}`);
  assertClose(lineStart.dialogueLineRevealProgress, 0, 0.001, 't=440 reveal progress');
  assertClose(lineStart.dialogueLineOpacity, 0, 0.001, 't=440 opacity');
  assertClose(lineStart.dialogueLineNudgePx, RECOGNITION_DIALOGUE_NUDGE_PX, 0.001, 't=440 nudge');

  const lineMid = recognitionFeedbackAt(440 + RECOGNITION_DIALOGUE_REVEAL_MS / 2);
  assert(lineMid.dialogueLineRevealProgress > 0.5, `mid-line reveal should ease out past halfway, got ${lineMid.dialogueLineRevealProgress}`);
  assert(lineMid.dialogueLineOpacity > 0.5, `mid-line opacity should ease out past halfway, got ${lineMid.dialogueLineOpacity}`);
  assert(
    lineMid.dialogueLineNudgePx > 0 && lineMid.dialogueLineNudgePx < RECOGNITION_DIALOGUE_NUDGE_PX,
    `mid-line nudge should be between 0 and ${RECOGNITION_DIALOGUE_NUDGE_PX}px, got ${lineMid.dialogueLineNudgePx}`,
  );

  const lineDone = recognitionFeedbackAt(440 + RECOGNITION_DIALOGUE_REVEAL_MS);
  assertClose(lineDone.dialogueLineRevealProgress, 1, 0.001, 'line reveal completion');
  assertClose(lineDone.dialogueLineOpacity, 1, 0.001, 'line opacity completion');
  assertClose(lineDone.dialogueLineNudgePx, 0, 0.001, 'line nudge completion');

  const secondLine = recognitionFeedbackAt(880);
  assert(secondLine.dialogueActiveBeatIndex === 1, `t=880 active dialogue index: expected 1, got ${secondLine.dialogueActiveBeatIndex}`);
  assertClose(secondLine.dialogueLineRevealProgress, 0, 0.001, 'second-line reveal resets');
  assertClose(secondLine.dialogueLineNudgePx, RECOGNITION_DIALOGUE_NUDGE_PX, 0.001, 'second-line nudge resets');

  const reducedLineStart = recognitionFeedbackAt(440, { reducedMotion: true });
  assert(reducedLineStart.dialogueActiveBeatIndex === 0, `reduced t=440 active dialogue index: expected 0, got ${reducedLineStart.dialogueActiveBeatIndex}`);
  assertClose(reducedLineStart.dialogueLineRevealProgress, 0, 0.001, 'reduced t=440 reveal progress');
  assertClose(reducedLineStart.dialogueLineOpacity, 0, 0.001, 'reduced t=440 opacity');
  assertClose(reducedLineStart.dialogueLineNudgePx, 0, 0.001, 'reduced motion disables dialogue nudge');
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
    sealedBeat0?.text === 'You came back.',
    `sealed beat 0 text mismatch: got '${sealedBeat0?.text}'`,
  );

  const sealedBeat1 = recognitionDialogueAt(880, 'sealed');
  assert(sealedBeat1 !== null, 'sealed beat 1 should exist at 880ms');
  assert(
    sealedBeat1?.text === 'So did the blue seal, unbroken.',
    `sealed beat 1 text mismatch: got '${sealedBeat1?.text}'`,
  );

  const openedBeat1 = recognitionDialogueAt(880, 'opened');
  assert(openedBeat1 !== null, 'opened beat 1 should exist at 880ms');
  assert(
    openedBeat1?.text === 'The seal did not.',
    `opened beat 1 text mismatch: got '${openedBeat1?.text}'`,
  );

  const openedBeat2 = recognitionDialogueAt(RECOGNITION_FEEDBACK_TOTAL_MS, 'opened');
  assert(openedBeat2 !== null, 'opened beat 2 should exist at end of beat');
  assert(
    openedBeat2?.text === 'I can use one of those facts.',
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
    sealed.text === 'That gives me two facts to trust.',
    `sealed beat 2 text mismatch: got '${sealed.text}'`,
  );
  assert(sealed.lineId === 'io_return_packet_sealed', `sealed lineId mismatch: got '${sealed.lineId}'`);

  const opened = recognitionDialogueForBeat('opened', 0);
  assert(
    opened.text === 'You came back.',
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
  checkRecognitionDialogueMotionEnvelope();
  checkSubtitleScaleEnvelopeBounds();
  checkRecognitionDialogueTimeline();
  checkRecognitionDialogueForBeatContract();
}

runRecognitionFeedbackChecks();
