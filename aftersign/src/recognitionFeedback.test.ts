// Standalone assertion harness for recognitionFeedbackAt.
//
// The repo has no test runner wired into `npm run typecheck:aftersign`
// (see PR #453 review — vitest is not a dependency), so this file is a
// plain-TS harness: run it with `tsx` / `node --loader` if you want the
// assertions to execute, but at typecheck time it's just a module with
// exported check functions and no external imports.
import {
  RECOGNITION_FEEDBACK_REDUCED_MOTION_TOTAL_MS,
  RECOGNITION_FEEDBACK_TOTAL_MS,
  publishRecognitionMemoryBeat,
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

export function checkDurationAndPeakContract(): void {
  assert(
    RECOGNITION_FEEDBACK_TOTAL_MS >= 1100 && RECOGNITION_FEEDBACK_TOTAL_MS <= 1350,
    `total duration: expected 1100-1350ms, got ${RECOGNITION_FEEDBACK_TOTAL_MS}ms`,
  );

  const peak = recognitionFeedbackAt(700, { outcome: 'sealed' });
  assert(
    peak.cameraDeltaMeters >= 0.24 && peak.cameraDeltaMeters <= 0.36,
    `t=700 cameraDeltaMeters: expected 0.24-0.36, got ${peak.cameraDeltaMeters}`,
  );
  assert(
    peak.cameraYawDegrees >= 3 && peak.cameraYawDegrees <= 5,
    `t=700 cameraYawDegrees: expected 3-5, got ${peak.cameraYawDegrees}`,
  );
}

export function checkOutcomeBranchDeltas(): void {
  const sealed = recognitionFeedbackAt(260, { outcome: 'sealed' });
  const opened = recognitionFeedbackAt(260, { outcome: 'opened' });

  assert(sealed.outcome === 'sealed', `sealed outcome mismatch: got ${sealed.outcome}`);
  assert(opened.outcome === 'opened', `opened outcome mismatch: got ${opened.outcome}`);
  assert(
    sealed.colorGrade !== opened.colorGrade,
    `color grade should differ by outcome, got '${sealed.colorGrade}' and '${opened.colorGrade}'`,
  );
  assert(
    sealed.cameraTargetOffsetY !== opened.cameraTargetOffsetY,
    `camera target offset should differ by outcome, got ${sealed.cameraTargetOffsetY} and ${opened.cameraTargetOffsetY}`,
  );
  assert(sealed.woodClickAtMs === null, `sealed woodClickAtMs: expected null, got ${sealed.woodClickAtMs}`);
  assertClose(opened.woodClickAtMs ?? -1, 165, 0.01, 'opened woodClickAtMs');
}

export function checkGlowAndStingTiming(): void {
  const preGlow = recognitionFeedbackAt(79, { outcome: 'sealed' });
  const postGlow = recognitionFeedbackAt(220, { outcome: 'sealed' });
  assertClose(preGlow.signGlowScale, 0.8, 0.01, 'pre-glow signGlowScale');
  assertClose(postGlow.signGlowScale, 1.35, 0.01, 'post-glow signGlowScale');

  const stingStart = recognitionFeedbackAt(120, { outcome: 'sealed' });
  const stingEnd = recognitionFeedbackAt(300, { outcome: 'sealed' });
  const stingAfter = recognitionFeedbackAt(301, { outcome: 'sealed' });
  assert(stingStart.stingActive, 'sting should start at 120ms');
  assert(stingEnd.stingActive, 'sting should be active through 300ms');
  assert(!stingAfter.stingActive, 'sting should end after 300ms');
  assertClose(stingStart.stingGainDb, -9, 0.01, 'sting gain dB');
}

export function checkReducedMotionFallback(): void {
  assert(
    RECOGNITION_FEEDBACK_REDUCED_MOTION_TOTAL_MS === 160,
    `reduced-motion duration: expected 160ms, got ${RECOGNITION_FEEDBACK_REDUCED_MOTION_TOTAL_MS}ms`,
  );

  const reduced = recognitionFeedbackAt(120, { outcome: 'opened', reducedMotion: true });
  assert(reduced.totalMs === 160, `reduced-motion totalMs: expected 160, got ${reduced.totalMs}`);
  assertClose(reduced.cameraDeltaMeters, 0, 0.0001, 'reduced-motion cameraDeltaMeters');
  assertClose(reduced.cameraYawDegrees, 0, 0.0001, 'reduced-motion cameraYawDegrees');
  assert(reduced.stingActive, 'reduced-motion should still include sting');
}

export function checkMemoryBeatPublishingContract(): void {
  const state = recognitionFeedbackAt(340, {
    outcome: 'opened',
    startedAt: 1_000,
  });

  const windowStub = {} as Window & typeof globalThis;
  const memoryBeat = publishRecognitionMemoryBeat(windowStub, state);
  const published = (windowStub as any).__game?.story?.memoryBeat;

  assert((windowStub as any).__game?.story?.currentNpcId === 'io', 'currentNpcId should be io');
  assert(published === memoryBeat, 'publish should return same memoryBeat object it writes');
  assert(memoryBeat.kind === 'io_packet_return', `kind mismatch: got ${memoryBeat.kind}`);
  assert(memoryBeat.outcome === 'opened', `outcome mismatch: got ${memoryBeat.outcome}`);
  assert(memoryBeat.startedAt === 1_000, `startedAt mismatch: got ${memoryBeat.startedAt}`);
  assert(memoryBeat.endedAt === 2_220, `endedAt mismatch: got ${memoryBeat.endedAt}`);
  assertClose(memoryBeat.cameraDeltaMeters, 0.32, 0.0001, 'memoryBeat cameraDeltaMeters');
  assertClose(memoryBeat.cameraYawDegrees, 4, 0.0001, 'memoryBeat cameraYawDegrees');
  assert(memoryBeat.inputLockMs === 1220, `inputLockMs mismatch: got ${memoryBeat.inputLockMs}`);
  assert(memoryBeat.lineId === 'io_return_packet_opened', `lineId mismatch: got ${memoryBeat.lineId}`);
}

export function runRecognitionFeedbackChecks(): void {
  checkDurationAndPeakContract();
  checkOutcomeBranchDeltas();
  checkGlowAndStingTiming();
  checkReducedMotionFallback();
  checkMemoryBeatPublishingContract();
}
