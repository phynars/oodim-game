export type CameraPose = {
  x: number;
  y: number;
  z: number;
  yawRadians: number;
};

export type IoMemoryBeatCameraMetrics = {
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
};

const RADIANS_TO_DEGREES = 180 / Math.PI;

const normalizeDegrees = (degrees: number): number => {
  let normalized = degrees % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
};

export const computeIoMemoryBeatCameraMetrics = (
  started: CameraPose,
  ended: CameraPose,
): IoMemoryBeatCameraMetrics => {
  const dx = ended.x - started.x;
  const dy = ended.y - started.y;
  const dz = ended.z - started.z;
  const cameraDeltaMeters = Math.hypot(dx, dy, dz);

  const yawDeltaDegrees = normalizeDegrees((ended.yawRadians - started.yawRadians) * RADIANS_TO_DEGREES);
  const cameraYawDegrees = Math.abs(yawDeltaDegrees);

  return {
    cameraDeltaMeters,
    cameraYawDegrees,
  };
};
