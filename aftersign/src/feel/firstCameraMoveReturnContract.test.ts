import { FIRST_CAMERA_MOVE_FEEL, sampleFirstCameraMoveTimeline } from "./firstCameraMove.ts";

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

export function checkFirstCameraMoveReturnContract(): void {
  const timeline = sampleFirstCameraMoveTimeline();
  const finalFrame = timeline[timeline.length - 1];
  const handbackFrame = timeline.find(
    (frame) => frame.timeMs >= FIRST_CAMERA_MOVE_FEEL.maximumControlLockMs,
  );

  if (!handbackFrame) {
    throw new AssertionError(
      `first camera move never reaches the ${FIRST_CAMERA_MOVE_FEEL.maximumControlLockMs}ms control handback mark`,
    );
  }

  assertLessThanOrEqual(
    handbackFrame.timeMs,
    FIRST_CAMERA_MOVE_FEEL.maximumControlLockMs + 17,
    "firstCameraMove.handbackFrameMs",
  );
  assertGreaterThanOrEqual(
    handbackFrame.yawDegrees,
    FIRST_CAMERA_MOVE_FEEL.yawDegrees * 0.70,
    "firstCameraMove.handbackYawProgress",
  );
  assertGreaterThanOrEqual(
    handbackFrame.dollyMeters,
    FIRST_CAMERA_MOVE_FEEL.dollyMeters * 0.70,
    "firstCameraMove.handbackDollyProgress",
  );

  if (finalFrame.yawDegrees !== FIRST_CAMERA_MOVE_FEEL.yawDegrees) {
    throw new AssertionError(
      `firstCameraMove.finalYaw: expected ${FIRST_CAMERA_MOVE_FEEL.yawDegrees}, got ${finalFrame.yawDegrees}`,
    );
  }

  if (finalFrame.dollyMeters !== FIRST_CAMERA_MOVE_FEEL.dollyMeters) {
    throw new AssertionError(
      `firstCameraMove.finalDolly: expected ${FIRST_CAMERA_MOVE_FEEL.dollyMeters}, got ${finalFrame.dollyMeters}`,
    );
  }
}

function assertGreaterThanOrEqual(actual: number, floor: number, label: string): void {
  if (actual < floor) {
    throw new AssertionError(`${label}: expected >= ${floor}, got ${actual}`);
  }
}

function assertLessThanOrEqual(actual: number, ceiling: number, label: string): void {
  if (actual > ceiling) {
    throw new AssertionError(`${label}: expected <= ${ceiling}, got ${actual}`);
  }
}
