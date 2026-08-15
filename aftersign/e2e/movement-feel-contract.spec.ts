import { expect, test } from "@playwright/test";

// Cold-start budget matches other AFTERSIGN e2e specs: SwiftShader + esm.sh
// three.js imports on CI regularly exceed Playwright's default 30s per-test
// timeout during the aftersign lane's cold boot. Without this override the
// spec races the wall clock instead of the feel contract and reports as a
// false red — the exact flake shape #700/#706 flagged and #714's CI
// re-review is chasing. See playwright.config.ts for the full rationale.
const COLD_START_MS = 90_000;

test("movement feel contract stays within one-frame response budget", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/?slot=movement-feel-contract");

  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: 60_000 });

  const result = await page.evaluate(() => window.__game.assertFeelContract());

  expect(result.passed).toBe(true);
  expect(result.movedThisFrame).toBe(true);
  expect(result.fixedStepInsideBudget).toBe(true);
  expect(result.inputToVelocityFrames).toBe(1);
  expect(result.lastStepMs).toBeLessThanOrEqual(result.targetFrameMs + 0.01);
});

test("keyboard traversal moves the avatar immediately while camera aim eases behind the target", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/?slot=movement-camera-keyboard-feel");

  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: 60_000 });

  const before = await page.evaluate(() => window.__game.getSnapshot());

  await page.keyboard.down("KeyD");
  await page.waitForFunction(() => {
    const snapshot = window.__game?.getSnapshot();
    return Boolean(snapshot?.movement.fixedStepsLastFrame > 0 && snapshot?.movement.lastVelocityMetersPerSecond > 0);
  }, undefined, { timeout: 5_000 });
  const moving = await page.evaluate(() => window.__game.getSnapshot());

  await page.keyboard.up("KeyD");
  await page.waitForFunction(() => window.__game?.getSnapshot().movement.input.active === false, undefined, { timeout: 5_000 });
  const released = await page.evaluate(() => window.__game.getSnapshot());

  expect(moving.player.x).toBeGreaterThan(before.player.x);
  expect(moving.movement.input.source).toBe("keyboard");
  expect(moving.movement.velocityX).toBeGreaterThan(0);
  expect(moving.movement.lastStepMs).toBeLessThanOrEqual(moving.movement.contract.targetFrameMs + 0.01);

  expect(moving.cameraRig.position.x).toBeLessThan(moving.cameraRig.lookAt.x);
  expect(moving.cameraRig.lookAt.x).toBeGreaterThan(before.cameraRig.lookAt.x);
  expect(moving.cameraRig.lookAt.x).toBeLessThan(moving.player.x + 1.52);

  expect(released.movement.input.active).toBe(false);
  expect(released.cameraRig.lookAt.x).toBeGreaterThan(released.player.x + 0.05);
});
