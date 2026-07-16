export type KioskCameraRigVector = {
  x: number;
  y: number;
  z: number;
};

export type KioskCameraRigState = {
  position: KioskCameraRigVector;
  target: KioskCameraRigVector;
  lookAt: KioskCameraRigVector;
  settledFrames: number;
};

export type KioskCameraRigConfig = {
  heightMeters: number;
  trailingDistanceMeters: number;
  sideOffsetMeters: number;
  lookAheadMeters: number;
  velocityLookAheadMeters: number;
  dampingPerSecond: number;
  snapEpsilonMeters: number;
};

export type KioskCameraRigInput = {
  playerX: number;
  playerZ: number;
  facingRadians: number;
  velocityX: number;
  velocityZ: number;
  dtSeconds?: number;
};

export const DEFAULT_KIOSK_CAMERA_RIG: KioskCameraRigConfig = {
  heightMeters: 2.35,
  trailingDistanceMeters: 6.15,
  sideOffsetMeters: 0.22,
  lookAheadMeters: 1.18,
  velocityLookAheadMeters: 0.34,
  dampingPerSecond: 180,
  snapEpsilonMeters: 0.18,
};

const DEFAULT_FIXED_STEP_SECONDS = 1 / 60;

const length2 = (x: number, z: number): number => Math.hypot(x, z);

const normalizedOrFacing = (
  x: number,
  z: number,
  facingRadians: number,
): { x: number; z: number } => {
  const length = length2(x, z);
  if (length > 0.0001) {
    return { x: x / length, z: z / length };
  }

  return {
    x: Math.sin(facingRadians),
    z: Math.cos(facingRadians),
  };
};

const approach = (current: number, target: number, alpha: number): number =>
  current + (target - current) * alpha;

export const computeKioskCameraTarget = (
  input: KioskCameraRigInput,
  config: KioskCameraRigConfig = DEFAULT_KIOSK_CAMERA_RIG,
): KioskCameraRigState['target'] => {
  const forward = normalizedOrFacing(input.velocityX, input.velocityZ, input.facingRadians);
  const right = { x: forward.z, z: -forward.x };
  const speed = length2(input.velocityX, input.velocityZ);
  const velocityLead = Math.min(config.velocityLookAheadMeters, speed * 0.09);

  return {
    x: input.playerX - forward.x * config.trailingDistanceMeters + right.x * config.sideOffsetMeters + forward.x * velocityLead,
    y: config.heightMeters,
    z: input.playerZ - forward.z * config.trailingDistanceMeters + right.z * config.sideOffsetMeters + forward.z * velocityLead,
  };
};

export const computeKioskCameraLookAt = (
  input: KioskCameraRigInput,
  config: KioskCameraRigConfig = DEFAULT_KIOSK_CAMERA_RIG,
): KioskCameraRigState['lookAt'] => {
  const forward = normalizedOrFacing(input.velocityX, input.velocityZ, input.facingRadians);
  const speed = length2(input.velocityX, input.velocityZ);
  const velocityLead = Math.min(config.velocityLookAheadMeters, speed * 0.09);
  const lead = config.lookAheadMeters + velocityLead;

  return {
    x: input.playerX + forward.x * lead,
    y: 1.08,
    z: input.playerZ + forward.z * lead,
  };
};

export const createKioskCameraRigState = (
  input: KioskCameraRigInput,
  config: KioskCameraRigConfig = DEFAULT_KIOSK_CAMERA_RIG,
): KioskCameraRigState => {
  const target = computeKioskCameraTarget(input, config);
  return {
    position: { ...target },
    target,
    lookAt: computeKioskCameraLookAt(input, config),
    settledFrames: 1,
  };
};

export const stepKioskCameraRig = (
  state: KioskCameraRigState,
  input: KioskCameraRigInput,
  config: KioskCameraRigConfig = DEFAULT_KIOSK_CAMERA_RIG,
): KioskCameraRigState => {
  const dtSeconds = input.dtSeconds ?? DEFAULT_FIXED_STEP_SECONDS;
  const target = computeKioskCameraTarget(input, config);
  const lookAt = computeKioskCameraLookAt(input, config);
  const alpha = 1 - Math.exp(-config.dampingPerSecond * dtSeconds);
  const position = {
    x: approach(state.position.x, target.x, alpha),
    y: approach(state.position.y, target.y, alpha),
    z: approach(state.position.z, target.z, alpha),
  };
  const error = length2(position.x - target.x, position.z - target.z);

  return {
    position,
    target,
    lookAt,
    settledFrames: error <= config.snapEpsilonMeters ? state.settledFrames + 1 : 0,
  };
};

class CameraRigAssertionError extends Error {}

// Must be a `function` declaration, not an arrow assigned to `const`:
// TypeScript rejects `asserts` predicate return types on arrow-function
// const declarations — that mismatch is what turned CI red.
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CameraRigAssertionError(message);
}

export function checkKioskCameraRigConvergesWithinTwoFramesAfterDirectionChange(): void {
  const config = DEFAULT_KIOSK_CAMERA_RIG;
  const idle = createKioskCameraRigState({
    playerX: -1.8,
    playerZ: 1.15,
    facingRadians: 0,
    velocityX: 0,
    velocityZ: 0,
  }, config);

  const firstFrame = stepKioskCameraRig(idle, {
    playerX: -1.8,
    playerZ: 1.15,
    facingRadians: Math.PI / 2,
    velocityX: 3.6,
    velocityZ: 0,
  }, config);
  const secondFrame = stepKioskCameraRig(firstFrame, {
    playerX: -1.74,
    playerZ: 1.15,
    facingRadians: Math.PI / 2,
    velocityX: 3.6,
    velocityZ: 0,
  }, config);

  const errorMeters = length2(
    secondFrame.position.x - secondFrame.target.x,
    secondFrame.position.z - secondFrame.target.z,
  );

  assert(errorMeters <= config.snapEpsilonMeters, `camera rig missed 2-frame convergence: ${errorMeters.toFixed(3)}m`);
  assert(secondFrame.lookAt.x > -1.74, 'camera lookAt should lead in the movement direction');
  assert(secondFrame.target.x < secondFrame.lookAt.x, 'follow camera should trail behind the led point');
}

export function runKioskCameraRigChecks(): void {
  checkKioskCameraRigConvergesWithinTwoFramesAfterDirectionChange();
}
