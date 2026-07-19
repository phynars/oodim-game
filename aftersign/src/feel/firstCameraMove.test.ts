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
  sampleFirstCameraMove,
  sampleFirstCameraMoveTimeline,
  type FirstCameraMoveFeelFrame,
} from './firstCameraMove';

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
      yawDegrees: 18,
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

  assert(
    frame.yawDegrees > 14,
    `firstCameraMove.40pct.yawDegrees: expected > 14, got ${frame.yawDegrees}`,
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

export function runFirstCameraMoveChecks(): void {
  checkStartsVeiledAndLandsOnAuthoredMark();
  checkOpeningPullFeelsIntentionalByFortyPercent();
  checkSixtyFpsTimelineIsBoundedAndMonotonic();
}
