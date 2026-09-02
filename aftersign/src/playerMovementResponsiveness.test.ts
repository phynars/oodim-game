import {
  DEFAULT_PLAYER_MOVEMENT_FEEL,
  createPlayerMovementState,
  normalizeMoveInput,
  stepPlayerMovementFixedUpdate,
} from "./playerMovementFeel.ts";
import { checkGroundedMovementResponsiveness } from "./playerMovementResponsiveness.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const speed = (state: { velocityX: number; velocityZ: number }) =>
  Math.hypot(state.velocityX, state.velocityZ);

export const checkGroundedMovementInputToMotionLatency = () => {
  const sample = checkGroundedMovementResponsiveness();
  assert(
    sample.movedMeters > 0,
    `forward input should move the player on the first frame; got movedMeters=${sample.movedMeters}`,
  );
  return sample;
};

export const checkGroundedMovementReleaseStopsWithinTwoFrames = () => {
  const movement = DEFAULT_PLAYER_MOVEMENT_FEEL;
  const frameBudgetSeconds = 1 / 60;
  let accumulator = 0;
  let current = createPlayerMovementState({
    x: 0,
    z: 0,
    facingRadians: Math.PI,
    input: normalizeMoveInput(0, -1, "keyboard", movement),
    velocityX: 0,
    velocityZ: 0,
    lastStepMs: 0,
    lastVelocityMetersPerSecond: 0,
  });

  const accelerated = stepPlayerMovementFixedUpdate(
    current,
    accumulator,
    frameBudgetSeconds * 4,
    movement,
  );
  current = accelerated.state;
  accumulator = accelerated.remainderSeconds;
  const movingSpeed = speed(current);

  const released = stepPlayerMovementFixedUpdate(
    {
      ...current,
      input: normalizeMoveInput(0, 0, "none", movement),
    },
    accumulator,
    frameBudgetSeconds * 2,
    movement,
  );

  assert(movingSpeed > 0, "setup expected player to be moving before release");
  assert(
    speed(released.state) < movingSpeed,
    `release should decelerate inside two frames; before=${movingSpeed}, after=${speed(released.state)}`,
  );

  return released.state;
};

export const runPlayerMovementResponsivenessChecks = () => {
  checkGroundedMovementInputToMotionLatency();
  checkGroundedMovementReleaseStopsWithinTwoFrames();
};

runPlayerMovementResponsivenessChecks();
