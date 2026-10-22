// AFTERSIGN presentation boundary: applies an already-derived camera rig pose.
// It owns no game state, scene progression, or input handling.

/**
 * Create the camera presentation controller.
 * @param {{ camera: import("three").Camera, THREE: typeof import("three") }} dependencies
 */
export function createCameraController({ camera, THREE }) {
  /**
   * Render a camera pose for this frame.
   * @param {{ rig: { position: { x: number, y: number, z: number }, lookAt: { x: number, y: number, z: number } }, recognitionDeltaMeters: number, recognitionYawDegrees: number, confirmWobble: number, confirmKickWorldX: number, confirmKickDegrees: number, failureWobble: number, failureKickWorldX: number, failureKickDegrees: number }} frame
   */
  function render(frame) {
    const {
      rig,
      recognitionDeltaMeters,
      recognitionYawDegrees,
      confirmWobble,
      confirmKickWorldX,
      confirmKickDegrees,
      failureWobble,
      failureKickWorldX,
      failureKickDegrees,
    } = frame;
    camera.position.x = rig.position.x + recognitionDeltaMeters + confirmWobble * confirmKickWorldX - failureWobble * failureKickWorldX;
    camera.position.y = rig.position.y;
    camera.position.z = rig.position.z;
    camera.lookAt(rig.lookAt.x, rig.lookAt.y, rig.lookAt.z);
    camera.rotation.z += THREE.MathUtils.degToRad(
      recognitionYawDegrees + confirmWobble * confirmKickDegrees - failureWobble * failureKickDegrees,
    );
  }

  return { render };
}
