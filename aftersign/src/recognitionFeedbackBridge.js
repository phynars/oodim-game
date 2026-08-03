import {
  recognitionFeedbackAt,
  RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS,
  RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES,
} from "./recognitionFeedback.ts";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const recognitionEnvelopeAt = (
  elapsedMs,
  outcome = "sealed",
  feedback,
) => {
  const base = recognitionFeedbackAt(elapsedMs, { outcome });
  const peakDelta = feedback?.cameraDeltaMeters ?? RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS;
  const peakYaw = feedback?.cameraYawDegrees ?? RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES;

  const deltaRatio = RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS === 0
    ? 0
    : peakDelta / RECOGNITION_FEEDBACK_CAMERA_DELTA_METERS;
  const yawRatio = RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES === 0
    ? 0
    : peakYaw / RECOGNITION_FEEDBACK_CAMERA_YAW_DEGREES;

  const signGlowBoost = clamp01(base.signEmissiveScale - 1);

  return {
    cameraDeltaMeters: Number((base.cameraDeltaMeters * deltaRatio).toFixed(3)),
    cameraYawDegrees: Number((base.cameraYawDegrees * yawRatio).toFixed(2)),
    signGlowBoost: Number(signGlowBoost.toFixed(3)),
  };
};
