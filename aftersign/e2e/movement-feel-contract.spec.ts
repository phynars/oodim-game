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
  // SwiftShader cold-start latency (#700/#506/#590/#766/#1551 review 4):
  // the first keydown after `page.goto` has to travel through the
  // fixed-step simulator on the very first frame budget the renderer
  // allocates. On CI hosts the initial rAF cadence can jitter past a
  // tight 5s wait even though everything downstream is healthy —
  // sibling `mobile-move-pad-served-feel.spec.ts` widened its two
  // waitForFunction bounds to 30s for the same flake shape. Widening
  // here absorbs the same variance without hiding a real regression:
  // the outer `COLD_START_MS = 90_000` still bounds the whole spec.
  await page.waitForFunction(() => {
    const snapshot = window.__game?.getSnapshot();
    return Boolean(snapshot?.movement.fixedStepsLastFrame > 0 && snapshot?.movement.lastVelocityMetersPerSecond > 0);
  }, undefined, { timeout: 30_000 });
  const moving = await page.evaluate(() => window.__game.getSnapshot());

  await page.keyboard.up("KeyD");
  // Same SwiftShader cold-start reasoning as the intent-poll above:
  // release-clean settles on the next fixed step, which can jitter
  // past a 5s bound on a cold host. 30s absorbs the variance; the
  // 90s outer test timeout still bounds the whole spec.
  await page.waitForFunction(() => window.__game?.getSnapshot().movement.input.active === false, undefined, { timeout: 30_000 });
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
