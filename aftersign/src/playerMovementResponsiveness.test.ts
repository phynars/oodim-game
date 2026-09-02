// Pure-runner consumer for the frame-driven grounded-movement
// responsiveness contract in `./playerMovementResponsiveness.ts`.
//
// Registered in `aftersign/pure-runner.ts` as
// `runPlayerMovementResponsivenessChecks`. Export-only — NO top-level
// invocation — so importing this file from pure-runner does not double-
// run the check when a Playwright pure lane also imports it.
//
// New invariant vs sibling `playerMovementFeel.ts::checkPlayerMovementFeel`:
// this bundle exercises `stepPlayerMovementFixedUpdate` (the render-loop
// accumulator path called from `aftersign/main.js:1338`) with one 60Hz
// frame's worth of `frameDt`, and asserts the accumulator consumes ≥ 1
// step and produces forward motion within `targetFrameMs`.
// `checkPlayerMovementFeel`'s `movedThisFrame` probe drives
// `stepPlayerMovement` DIRECTLY (single fixed step, no accumulator) and
// its only call to `stepPlayerMovementFixedUpdate` (spike-cap probe)
// pumps `fixedStepSeconds * (maxSteps + 3)` — the capping path, not the
// ordinary one-frame-in / one-step-out contract that ships every tick.
//
// Extension contract: sole relative import is `./playerMovementResponsiveness.ts`
// (extensioned) whose sole relative import in turn is `./playerMovementFeel.ts`
// (extensioned, zero relative imports itself) — satisfies the pure-runner
// extension-resolution contract documented in `aftersign/pure-runner.ts`.
import { checkGroundedMovementResponsiveness } from "./playerMovementResponsiveness.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const checkFrameDrivenInputToMotionLatency = () => {
  const sample = checkGroundedMovementResponsiveness();
  assert(
    sample.steps >= 1,
    `one 60Hz frame should consume ≥ 1 fixed step; got steps=${sample.steps}`,
  );
  assert(
    sample.movedMeters > 0,
    `forward input on frame one should move the player; got movedMeters=${sample.movedMeters}`,
  );
  assert(
    sample.deltaMs <= sample.targetFrameMs + 0.01,
    `frame-driven step should land inside targetFrameMs=${sample.targetFrameMs}; got deltaMs=${sample.deltaMs}`,
  );
  return sample;
};

export const runPlayerMovementResponsivenessChecks = () => {
  checkFrameDrivenInputToMotionLatency();
};
