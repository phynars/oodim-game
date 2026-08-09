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
    // window.__game exposes setMoveInput / assertFeelContract / resetSliceSave
    // at the TOP LEVEL (aftersign/main.js ~line 710, 721, 724). The earlier
    // `game.input?.setMoveInput` shape was wrong — the guard threw on every
    // run, crashing the spec before any assertion and leaving Playwright
    // unable to write results.json (PR #1085 review).
    const game = window.__game as unknown as {
      version: number;
      setMoveInput?: (x: number, z: number, source?: string) => void;
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
      !game?.setMoveInput
      || !game.assertFeelContract
      || !game.resetSliceSave
      || !game.getSnapshot
    ) {
      throw new Error(
        "Missing AFTERSIGN input feel hooks: setMoveInput, assertFeelContract, resetSliceSave, getSnapshot",
      );
    }

    game.setMoveInput(1, 0, "script");

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const afterInput = game.getSnapshot();
    const contract = game.assertFeelContract();

    await game.resetSliceSave();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const afterReset = (window.__game as unknown as {
      getSnapshot: () => {
        movement: { input: { x: number; z: number; source: string } };
        player: { x: number; z: number };
      };
    }).getSnapshot();

    return {
      contract,
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

  expect(result.afterReset.input).toMatchObject({ x: 0, z: 0 });
  expect(result.afterReset.x).toBe(0);
  expect(result.afterReset.z).toBe(0);
});
