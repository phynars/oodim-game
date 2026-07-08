import {
  INTERACTION_CONFIRM_PROFILE,
  REDUCED_MOTION_CONFIRM_PROFILE,
  sampleInteractionConfirmFeedback,
} from "./interactionConfirmFeedback";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function approx(actual: number, expected: number, epsilon: number, label: string): void {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${label}: expected ${expected} ±${epsilon}, got ${actual}`);
  }
}

export function runInteractionConfirmFeedbackChecks(): void {
  assert(INTERACTION_CONFIRM_PROFILE.durationMs === 180, "confirm duration must be 180ms");
  assert(INTERACTION_CONFIRM_PROFILE.hitStopFrames === 3, "confirm hit-stop must be 3 frames");
  assert(INTERACTION_CONFIRM_PROFILE.shakeAmplitudePx.x === 6, "confirm shake x must be 6px");
  assert(INTERACTION_CONFIRM_PROFILE.shakeAmplitudePx.y === 4, "confirm shake y must be 4px");
  assert(INTERACTION_CONFIRM_PROFILE.yawDeg === 1.6, "confirm yaw must be 1.6deg");
  assert(INTERACTION_CONFIRM_PROFILE.audioLeadMs === -18, "audio must lead by 18ms");

  const start = sampleInteractionConfirmFeedback(0);
  approx(start.scale, INTERACTION_CONFIRM_PROFILE.overshootScale, 0.0001, "start scale");
  assert(start.done === false, "start sample cannot be done");

  const mid = sampleInteractionConfirmFeedback(90);
  assert(mid.glow > start.glow, "glow should ramp up by midpoint");
  assert(Math.abs(mid.shakeX) <= INTERACTION_CONFIRM_PROFILE.shakeAmplitudePx.x, "shakeX bounded");
  assert(Math.abs(mid.shakeY) <= INTERACTION_CONFIRM_PROFILE.shakeAmplitudePx.y, "shakeY bounded");

  const end = sampleInteractionConfirmFeedback(180);
  approx(end.scale, INTERACTION_CONFIRM_PROFILE.settleScale, 0.0001, "end scale");
  approx(end.shakeX, 0, 0.0001, "end shakeX");
  approx(end.shakeY, 0, 0.0001, "end shakeY");
  assert(end.done === true, "end sample should be done");

  const reduced = sampleInteractionConfirmFeedback(70, true);
  assert(REDUCED_MOTION_CONFIRM_PROFILE.shakeAmplitudePx.x === 0, "reduced profile has zero shake");
  assert(REDUCED_MOTION_CONFIRM_PROFILE.yawDeg === 0, "reduced profile has zero yaw");
  approx(reduced.shakeX, 0, 0.0001, "reduced shakeX");
  approx(reduced.shakeY, 0, 0.0001, "reduced shakeY");
}

runInteractionConfirmFeedbackChecks();
