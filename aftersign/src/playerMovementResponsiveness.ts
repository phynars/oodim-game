import {
  DEFAULT_PLAYER_MOVEMENT_FEEL,
  createPlayerMovementState,
  normalizeMoveInput,
  stepPlayerMovementFixedUpdate,
} from "./playerMovementFeel.ts";

export type GroundedMovementResponsivenessSample = {
  steps: number;
  deltaMs: number;
  speedMetersPerSecond: number;
  movedMeters: number;
  withinOneFrame: boolean;
};

export const sampleGroundedMovementInputLatency = (
  frameDtSeconds = 1 / 60,
): GroundedMovementResponsivenessSample => {
  const movement = DEFAULT_PLAYER_MOVEMENT_FEEL;
  const initial = createPlayerMovementState({
    x: 0,
    z: 0,
    facingRadians: Math.PI,
    input: normalizeMoveInput(0, 0, "none", movement),
    velocityX: 0,
    velocityZ: 0,
    lastStepMs: 0,
    lastVelocityMetersPerSecond: 0,
  });
  const result = stepPlayerMovementFixedUpdate(
    {
      ...initial,
      input: normalizeMoveInput(0, -1, "keyboard", movement),
    },
    0,
    frameDtSeconds,
    movement,
  );
  const speedMetersPerSecond = Math.hypot(
    result.state.velocityX,
    result.state.velocityZ,
  );
  const movedMeters = Math.hypot(
    result.state.x - initial.x,
    result.state.z - initial.z,
  );
  return {
    steps: result.steps,
    deltaMs: result.state.lastStepMs,
    speedMetersPerSecond,
    movedMeters,
    withinOneFrame: result.steps >= 1
      && speedMetersPerSecond > 0
      && result.state.lastStepMs <= 17,
  };
};

export const checkGroundedMovementResponsiveness = () => {
  const sample = sampleGroundedMovementInputLatency();
  if (!sample.withinOneFrame) {
    throw new Error(
      `grounded movement input-to-motion exceeded one frame: ${JSON.stringify(sample)}`,
    );
  }
  return sample;
};
