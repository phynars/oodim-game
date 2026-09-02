/**
 * First-camera-move feel primitive for AFTERSIGN's runnable vertical slice.
 *
 * Target feel:
 * - touch deadzone: 12 CSS px before yaw engages
 * - move: 18 degrees of yaw
 * - duration: 420 ms
 * - easing: cubic-out
 * - arrival tolerance for acceptance: 0.5 degrees
 *
 * This module is intentionally dependency-free so the served page can import it
 * before three.js scene wiring exists in this repository snapshot.
 */
export const FIRST_CAMERA_MOVE = Object.freeze({
  yawDegrees: 18,
  durationMs: 420,
  touchDeadzonePx: 12,
  arrivalToleranceDegrees: 0.5,
});

export function cubicOut(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export function firstCameraYawAt(elapsedMs, config = FIRST_CAMERA_MOVE) {
  const progress = cubicOut(elapsedMs / config.durationMs);
  return config.yawDegrees * progress;
}

export function hasPassedFirstCameraDeadzone(startPoint, currentPoint, config = FIRST_CAMERA_MOVE) {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  return Math.hypot(dx, dy) >= config.touchDeadzonePx;
}

export function isFirstCameraMoveSettled(currentYawDegrees, config = FIRST_CAMERA_MOVE) {
  return Math.abs(config.yawDegrees - currentYawDegrees) <= config.arrivalToleranceDegrees;
}
