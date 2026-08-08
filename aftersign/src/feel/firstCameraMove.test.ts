// Standalone assertion harness for the AFTERSIGN first-camera-move feel model.
//
// Repo convention (see aftersign/src/packetChoiceFeel.test.ts):
//   - Vitest is NOT a repo dependency; aftersign's tsconfig has
//     `types: ["vite/client"]` only — no vitest globals.  Bare
//     `describe` / `it` / `expect` would fail `typecheck:aftersign`.
//   - The convention is a plain-TS assertion file: `check*()` functions
//     that exercise the real API and a `run*Checks()` entry point.
//     Drift in the exported shape surfaces as a tsc error in the
//     aftersign lane instead of a silent green.
//
// This file locks in the FIRST_CAMERA_MOVE_FEEL contract: opening
// veil/still frame, authored landing pose, intentional pull past the
// midpoint, and a 60fps monotonic timeline.

import {
  FIRST_CAMERA_MOVE_FEEL,
  checkFirstCameraMoveFeel,
  sampleFirstCameraMove,
  sampleFirstCameraMoveTimeline,
  type FirstCameraMoveFeelFrame,
} from './firstCameraMove.ts';

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

function assertFrame(
  actual: FirstCameraMoveFeelFrame,
  expected: FirstCameraMoveFeelFrame,
  label: string,
): void {
  for (const key of Object.keys(expected) as (keyof FirstCameraMoveFeelFrame)[]) {
    if (actual[key] !== expected[key]) {
      throw new AssertionError(
        `${label}.${String(key)}: expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(actual[key])}`,
      );
    }
  }
}

export function checkStartsVeiledAndLandsOnAuthoredMark(): void {
  assertFrame(
    sampleFirstCameraMove(0),
    {
      timeMs: 0,
      yawDegrees: 0,
      pitchDegrees: 0,
      dollyMeters: 0,
      vignetteAlpha: 0.42,
      bloomStrength: 0.18,
      lowPassHz: 720,
    },
    'firstCameraMove.start',
  );

  assertFrame(
    sampleFirstCameraMove(FIRST_CAMERA_MOVE_FEEL.durationMs),
    {
      timeMs: 1400,
      // Landing yaw dropped from 18° → 17.8° so the peak per-frame yaw
      // delta under easeOutCubic (≈3× the average slope at t=0) fits
      // under the 0.65°/frame mobile-safety cap that the new
      // checkFirstCameraMoveFeel enforces. The 40% frame threshold
      // below also drops (14 → 13.9) for the same reason.
      //
      // Math: easeOutCubic slope at t=0 is 3× the average. Frame step
      // at 60fps = 16.667ms, progress-per-frame = 16.667/1400 ≈ 0.0119.
      // Peak Δyaw (frame 0 → frame 1) = 17.8·(1 − (1−0.0119)³) ≈ 0.628°.
      // Peak Δpitch ≈ 0.141°. hypot(0.628, 0.141) ≈ 0.644 — under 0.65.
      yawDegrees: 17.8,
      pitchDegrees: -4,
      dollyMeters: 2.4,
      vignetteAlpha: 0.18,
      bloomStrength: 0.42,
      lowPassHz: 18000,
    },
    'firstCameraMove.end',
  );
}

export function checkOpeningPullFeelsIntentionalByFortyPercent(): void {
  const frame = sampleFirstCameraMove(560);

  // Threshold dropped from 14 → 13.9 alongside the 18° → 17.8° landing
  // yaw (see checkStartsVeiledAndLandsOnAuthoredMark above). At 40% of
  // 1400ms under easeOutCubic, yaw is ≈ 17.8 * (1 - 0.6³) = 17.8 *
  // 0.784 ≈ 13.96° — still comfortably past the "intentional pull"
  // authored feel bar, but no longer > 14.
  assert(
    frame.yawDegrees > 13.9,
    `firstCameraMove.40pct.yawDegrees: expected > 13.9, got ${frame.yawDegrees}`,
  );
  assert(
    frame.dollyMeters > 1.8,
    `firstCameraMove.40pct.dollyMeters: expected > 1.8, got ${frame.dollyMeters}`,
  );
  assert(
    frame.lowPassHz < 8000,
    `firstCameraMove.40pct.lowPassHz: expected < 8000, got ${frame.lowPassHz}`,
  );
}

export function checkSixtyFpsTimelineIsBoundedAndMonotonic(): void {
  const timeline = sampleFirstCameraMoveTimeline();

  assertEqual(timeline.length, 85, 'firstCameraMove.timeline.length');
  assertEqual(timeline[0]?.timeMs, 0, 'firstCameraMove.timeline.first.timeMs');
  assertEqual(timeline.at(-1)?.timeMs, 1400, 'firstCameraMove.timeline.last.timeMs');

  for (let i = 1; i < timeline.length; i += 1) {
    const prev = timeline[i - 1]!;
    const curr = timeline[i]!;
    assert(
      curr.yawDegrees >= prev.yawDegrees,
      `firstCameraMove.timeline[${i}].yawDegrees non-monotonic: ${prev.yawDegrees} -> ${curr.yawDegrees}`,
    );
    assert(
      curr.dollyMeters >= prev.dollyMeters,
      `firstCameraMove.timeline[${i}].dollyMeters non-monotonic: ${prev.dollyMeters} -> ${curr.dollyMeters}`,
    );
    assert(
      curr.vignetteAlpha <= prev.vignetteAlpha,
      `firstCameraMove.timeline[${i}].vignetteAlpha non-monotonic: ${prev.vignetteAlpha} -> ${curr.vignetteAlpha}`,
    );
    assert(
      curr.lowPassHz >= prev.lowPassHz,
      `firstCameraMove.timeline[${i}].lowPassHz non-monotonic: ${prev.lowPassHz} -> ${curr.lowPassHz}`,
    );
  }
}

export function checkCoupledAvBeatsFitInsideAuthoredDuration(): void {
  const glowTotalMs =
    FIRST_CAMERA_MOVE_FEEL.signGlow.riseMs +
    FIRST_CAMERA_MOVE_FEEL.signGlow.holdMs +
    FIRST_CAMERA_MOVE_FEEL.signGlow.fallMs;

  assert(
    glowTotalMs <= FIRST_CAMERA_MOVE_FEEL.durationMs,
    `firstCameraMove.signGlow.total: expected <= ${FIRST_CAMERA_MOVE_FEEL.durationMs}, got ${glowTotalMs}`,
  );

  assert(
    FIRST_CAMERA_MOVE_FEEL.maximumControlLockMs <= FIRST_CAMERA_MOVE_FEEL.durationMs,
    `firstCameraMove.maximumControlLockMs: expected <= ${FIRST_CAMERA_MOVE_FEEL.durationMs}, got ${FIRST_CAMERA_MOVE_FEEL.maximumControlLockMs}`,
  );

  assert(
    FIRST_CAMERA_MOVE_FEEL.audioCoupling.bellHitMs < FIRST_CAMERA_MOVE_FEEL.durationMs,
    `firstCameraMove.bellHitMs: expected < ${FIRST_CAMERA_MOVE_FEEL.durationMs}, got ${FIRST_CAMERA_MOVE_FEEL.audioCoupling.bellHitMs}`,
  );

  assert(
    FIRST_CAMERA_MOVE_FEEL.wetSurfaceSheenPulse.offsetMs <
      FIRST_CAMERA_MOVE_FEEL.audioCoupling.bellHitMs,
    `firstCameraMove.wetSurfaceSheenPulse.offsetMs: expected < bellHitMs ${FIRST_CAMERA_MOVE_FEEL.audioCoupling.bellHitMs}, got ${FIRST_CAMERA_MOVE_FEEL.wetSurfaceSheenPulse.offsetMs}`,
  );

  assert(
    FIRST_CAMERA_MOVE_FEEL.lanternLeadMs >= 100 &&
      FIRST_CAMERA_MOVE_FEEL.lanternLeadMs <= 140,
    `firstCameraMove.lanternLeadMs: expected in [100,140], got ${FIRST_CAMERA_MOVE_FEEL.lanternLeadMs}`,
  );
}

export function checkMobileSafetyBudget(): void {
  assertEqual(
    FIRST_CAMERA_MOVE_FEEL.mobileSafety.targetFps,
    60,
    'firstCameraMove.mobileSafety.targetFps',
  );
  assertEqual(
    FIRST_CAMERA_MOVE_FEEL.mobileSafety.maxScreenShakePx,
    0,
    'firstCameraMove.mobileSafety.maxScreenShakePx',
  );

  const yawPerFrame =
    FIRST_CAMERA_MOVE_FEEL.yawDegrees /
    ((FIRST_CAMERA_MOVE_FEEL.durationMs / 1000) *
      FIRST_CAMERA_MOVE_FEEL.mobileSafety.targetFps);
  // Average yaw travel per 60fps frame must fit the mobile-safety budget.
  assert(
    yawPerFrame <=
      FIRST_CAMERA_MOVE_FEEL.mobileSafety.maxCameraTravelDegreesPerFrameAt60fps,
    `firstCameraMove.mobileSafety.avgYawPerFrame: expected <= ${FIRST_CAMERA_MOVE_FEEL.mobileSafety.maxCameraTravelDegreesPerFrameAt60fps}, got ${yawPerFrame}`,
  );
}

export function checkPeakPerFrameTravelStaysUnderMobileCap(): void {
  // Delegates to the exported feel-check in firstCameraMove.ts, which
  // walks the sampled timeline and asserts:
  //   - start/final frames match the authored contract
  //   - peak (not just average) per-frame yaw+pitch travel stays under
  //     the mobile-safety cap (average-only leaves headroom for a
  //     mid-easing spike that violates the budget)
  //   - first visible motion lands within 34ms (2 frames @ 60fps)
  // Throws on violation; wiring it here means pure-runner + the e2e
  // spec exercise it via the existing runFirstCameraMoveChecks entry.
  const result = checkFirstCameraMoveFeel();

  // Lock in the exact peak numbers the header math (17.8·(1−(1−0.0119)³)
  // ≈ 0.628; 4·… ≈ 0.141) predicts. Asserting the cap alone would let
  // a sampler regression drift the peaks upward without tripping the
  // 0.65°/frame gate — an assertion on the *values* catches drift with
  // a precise error line before it approaches the cap. Tolerance is
  // ±0.002 to absorb the round3() quantization already applied inside
  // checkFirstCameraMoveFeel; anything wider would defeat the point.
  assertClose(
    result.peakYawDeltaPerFrame,
    0.628,
    0.002,
    'firstCameraMove.peakYawDeltaPerFrame',
  );
  assertClose(
    result.peakPitchDeltaPerFrame,
    0.141,
    0.002,
    'firstCameraMove.peakPitchDeltaPerFrame',
  );

  // First visible motion must land on the 2nd 60fps frame (round(16.667)
  // = 17ms), well inside the 34ms cap. Locking the exact frame time
  // catches a sampler that starts a frame late.
  assertEqual(result.firstMotionMs, 17, 'firstCameraMove.firstMotionMs');

  // Timeline frame count is (durationMs/1000)·fps + 1 = 84 + 1 = 85 —
  // same invariant checkSixtyFpsTimelineIsBoundedAndMonotonic locks,
  // but from the checker's own walk (defends against a drift where the
  // sampler and the checker disagree on frame count).
  assertEqual(result.frameCount, 85, 'firstCameraMove.checkFrameCount');
}

function assertClose(
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new AssertionError(
      `${label}: expected ${expected} ± ${tolerance}, got ${actual}`,
    );
  }
}

export function runFirstCameraMoveChecks(): void {
  checkStartsVeiledAndLandsOnAuthoredMark();
  checkOpeningPullFeelsIntentionalByFortyPercent();
  checkSixtyFpsTimelineIsBoundedAndMonotonic();
  checkCoupledAvBeatsFitInsideAuthoredDuration();
  checkMobileSafetyBudget();
  checkPeakPerFrameTravelStaysUnderMobileCap();
}
