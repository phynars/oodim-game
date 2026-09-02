// Frame-driven grounded-movement responsiveness pin.
//
// The sibling `playerMovementFeel.ts::checkPlayerMovementFeel` already
// asserts `movedThisFrame` and `releaseDeceleratesWithinOneFrame` — but
// those probes call `stepPlayerMovement` directly (single fixed step,
// no accumulator). The RENDER-LOOP path in `aftersign/main.js:1338`
// is `stepPlayerMovementFixedUpdate(state, accumulator, frameDt, MOVEMENT)`
// — the frame-driven accumulator wrapper. This bundle pins the invariant
// that ONE 60Hz frame's worth of `frameDt` (1/60s) fed to the accumulator:
//
//   - consumes ≥ 1 fixed step
//   - reports `lastStepMs` inside `targetFrameMs`
//   - moves the player forward (movedMeters > 0)
//
// checkPlayerMovementFeel does not cover this path (its single call to
// `stepPlayerMovementFixedUpdate` — line 270 in playerMovementFeel.ts —
// is a spike-cap test with `frameDt = fixedStepSeconds * (maxSteps + 3)`,
// which pins the CAPPING behavior, not the ordinary one-frame-in / one-
// step-out contract that ships every render tick).
//
// Extension contract: sole relative import is `./playerMovementFeel.ts`
// (extensioned), whose leaf has zero relative imports — satisfies the
// pure-runner extension-resolution contract documented in pure-runner.ts.
import {
  DEFAULT_PLAYER_MOVEMENT_FEEL,
  createPlayerMovementState,
  normalizeMoveInput,
  stepPlayerMovementFixedUpdate,
} from "./playerMovementFeel.ts";

export type GroundedMovementResponsivenessSample = {
  steps: number;
  deltaMs: number;
  targetFrameMs: number;
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
    targetFrameMs: movement.targetFrameMs,
    speedMetersPerSecond,
    movedMeters,
    withinOneFrame: result.steps >= 1
      && speedMetersPerSecond > 0
      && movedMeters > 0
      && result.state.lastStepMs <= movement.targetFrameMs + 0.01,
  };
};

export const checkGroundedMovementResponsiveness = () => {
  const sample = sampleGroundedMovementInputLatency();
  if (!sample.withinOneFrame) {
    throw new Error(
      `frame-driven grounded movement failed one-frame input-to-motion contract: ${JSON.stringify(sample)}`,
    );
  }
  return sample;
};
