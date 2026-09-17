export const createCameraPoseSampler = ({
  state,
  CONFIRM_FEEDBACK,
  FAILURE_FEEDBACK,
  prefersReducedMotion,
  interactionConfirmEnvelopeAt,
  failureStingEnvelopeAt,
  recognitionMotionAt,
  computeKioskCameraTarget,
  DEFAULT_KIOSK_CAMERA_RIG,
  THREE,
}) => {
  const computeCameraPoseAt = (nowMs) => {
    const confirmStartedAt = state.interaction.confirmStartedAt;
    const failureStartedAt = state.interaction.failureStartedAt;
    const confirmReducedMotion = prefersReducedMotion();
    const confirmEnvelope = confirmStartedAt === null
      ? interactionConfirmEnvelopeAt(CONFIRM_FEEDBACK.durationMs, CONFIRM_FEEDBACK, {
          reducedMotion: confirmReducedMotion,
        })
      : interactionConfirmEnvelopeAt(nowMs - confirmStartedAt, CONFIRM_FEEDBACK, {
          reducedMotion: confirmReducedMotion,
        });
    const confirmWobble = confirmEnvelope.wobble;
    const failureReducedMotion = confirmReducedMotion;
    const failureEnvelope = failureStartedAt === null
      ? failureStingEnvelopeAt(FAILURE_FEEDBACK.durationMs, FAILURE_FEEDBACK, {
          reducedMotion: failureReducedMotion,
        })
      : failureStingEnvelopeAt(nowMs - failureStartedAt, FAILURE_FEEDBACK, {
          reducedMotion: failureReducedMotion,
        });
    const failureWobble = failureEnvelope.wobble;
    const cameraKickWorldX = state.interaction.confirmFeedback.cameraKickWorldX;
    const cameraKickDeg = state.interaction.confirmFeedback.cameraKickDeg;
    const recognitionMotion = recognitionMotionAt(nowMs);
    const restingPose = computeKioskCameraTarget(
      {
        playerX: state.player.x,
        playerZ: state.player.z,
        facingRadians: state.player.facingRadians,
        velocityX: 0,
        velocityZ: 0,
      },
      DEFAULT_KIOSK_CAMERA_RIG,
    );
    return {
      x: restingPose.x + recognitionMotion.cameraDeltaMeters + confirmWobble * cameraKickWorldX - failureWobble * FAILURE_FEEDBACK.cameraKickWorldX,
      z: restingPose.z,
      rotationZ: THREE.MathUtils.degToRad(recognitionMotion.cameraYawDegrees + confirmWobble * cameraKickDeg - failureWobble * FAILURE_FEEDBACK.cameraKickDeg),
    };
  };

  return { computeCameraPoseAt };
};
