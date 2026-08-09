import { expect, test } from "@playwright/test";

// Cold-start budget matches sibling AFTERSIGN specs (movement-feel-contract.spec.ts):
// SwiftShader + esm.sh three.js imports on CI regularly exceed Playwright's
// default 30s per-test timeout during the aftersign lane's cold boot.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

test("input-to-render feel contract samples active move input before assertion and clears on reset", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);

  await page.goto("/?slot=input-to-render-feel-contract");
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });

  const result = await page.evaluate(async () => {
    // Hook placement on window.__game (aftersign/main.js):
    //   - game.input.setMoveInput  (line ~710, inside the `input:` bag opened
    //     at line 704 — same shape as choose/advance/forceSave/forceReload)
    //   - game.assertFeelContract  (line ~721, TOP-LEVEL)
    //   - game.getSnapshot         (line ~661, TOP-LEVEL)
    //   - game.resetSliceSave      (line ~724, TOP-LEVEL)
    //
    // The prior revision assumed `game.setMoveInput` was top-level; the guard
    // below then threw on every run, aborting Playwright before results.json
    // was written (PR #1085 CI blocker Ivy flagged twice). Every other spec
    // that drives input uses `window.__game.input.*` — see
    // packet-choice-controls.spec.ts, packet-intent-scene.spec.ts, etc.
    const game = window.__game as unknown as {
      version: number;
      input?: {
        setMoveInput?: (x: number, z: number, source?: string) => void;
      };
      assertFeelContract?: () => {
        passed: boolean;
        movedThisFrame: boolean;
        inputToVelocityFrames: number;
        fixedStepInsideBudget: boolean;
        targetFrameMs: number;
      };
      resetSliceSave?: () => Promise<void> | void;
      getSnapshot?: () => {
        movement: {
          input: { x: number; z: number; source: string };
          lastStepMs: number;
          lastVelocityMetersPerSecond: number;
        };
        player: { x: number; z: number };
      };
    };

    if (
      !game?.input?.setMoveInput
      || !game.assertFeelContract
      || !game.resetSliceSave
      || !game.getSnapshot
    ) {
      throw new Error(
        "Missing AFTERSIGN input feel hooks: game.input.setMoveInput, game.assertFeelContract, game.resetSliceSave, game.getSnapshot",
      );
    }

    game.input.setMoveInput(1, 0, "script");

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const afterInput = game.getSnapshot();
    const contract = game.assertFeelContract();

    await game.resetSliceSave();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const resetGame = window.__game as unknown as {
      assertFeelContract: () => {
        passed: boolean;
        movedThisFrame: boolean;
        inputToVelocityFrames: number;
        fixedStepInsideBudget: boolean;
        targetFrameMs: number;
      };
      getSnapshot: () => {
        movement: { input: { x: number; z: number; source: string } };
        player: { x: number; z: number };
      };
    };
    const afterReset = resetGame.getSnapshot();
    const afterResetContract = resetGame.assertFeelContract();

    return {
      contract,
      afterResetContract,
      afterInput: {
        input: afterInput.movement.input,
        x: afterInput.player.x,
        z: afterInput.player.z,
        lastStepMs: afterInput.movement.lastStepMs,
        lastVelocityMetersPerSecond: afterInput.movement.lastVelocityMetersPerSecond,
      },
      afterReset: {
        input: afterReset.movement.input,
        x: afterReset.player.x,
        z: afterReset.player.z,
      },
    };
  });

  expect(result.contract.passed).toBe(true);
  expect(result.contract.movedThisFrame).toBe(true);
  expect(result.contract.inputToVelocityFrames).toBe(1);
  expect(result.contract.fixedStepInsideBudget).toBe(true);

  expect(result.afterInput.input).toMatchObject({
    x: expect.any(Number),
    z: expect.any(Number),
    source: "script",
  });
  expect(result.afterInput.input.x).toBeGreaterThan(0);
  expect(result.afterInput.lastStepMs).toBeLessThanOrEqual(result.contract.targetFrameMs + 0.01);
  expect(result.afterInput.lastVelocityMetersPerSecond).toBeGreaterThan(0);
  expect(Math.abs(result.afterInput.x) + Math.abs(result.afterInput.z)).toBeGreaterThan(0);

  // resetSliceSave restores player to the kiosk-facing SPAWN (main.js:1509-1510),
  // not (0, 0) — the slice's boot default is x=-1.8, z=1.15 so the trailing
  // camera lands behind the player facing the kiosk. Zeroing to (0,0) would
  // silently rotate the slice away from the served-page contract. Ivy's
  // non-blocking note called this out (PR #1085): this equality only holds
  // because this spec uses a dedicated slot (`input-to-render-feel-contract`)
  // and doesn't share localStorage with another spec that would persist a
  // different spawn.
  expect(result.afterReset.input).toMatchObject({ x: 0, z: 0, source: "none" });
  expect(result.afterReset.x).toBeCloseTo(-1.8, 6);
  expect(result.afterReset.z).toBeCloseTo(1.15, 6);

  // assertFeelContract → checkPlayerMovementFeel(MOVEMENT) is a pure config
  // probe (playerMovementFeel.ts:185-229): it synthesizes its own
  // normalizeMoveInput(1,0,"harness") from a fresh createPlayerMovementState
  // and never reads live state.movement.input. So `passed` is deterministic
  // on the constant config and worth asserting post-reset (proves the
  // contract still holds), but `movedThisFrame` is `true` by construction —
  // asserting `false` was unsatisfiable (Soren, PR #1092 review).
  //
  // The live "no movement occurred post-reset" signal is already covered by
  // the `afterReset.input` → {x:0, z:0, source:"none"} assertion above.
  expect(result.afterResetContract.passed).toBe(true);
});
