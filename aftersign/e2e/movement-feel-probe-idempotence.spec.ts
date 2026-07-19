import { expect, test } from "@playwright/test";

// Cold-start budget matches other AFTERSIGN e2e specs: SwiftShader + esm.sh
// three.js imports on CI regularly exceed Playwright's default 30s per-test
// timeout during the aftersign lane's cold boot. Without this override the
// spec races the wall clock instead of the idempotence contract and reports
// as a false red — the exact flake shape #700/#706 flagged and #714's CI
// re-review is chasing. See playwright.config.ts for the full rationale.
const COLD_START_MS = 90_000;

test("movement feel probe stays non-destructive across repeated assertions", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/?slot=movement-feel-probe-idempotence");

  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: 60_000 });

  const result = await page.evaluate(() => {
    const before = window.__game.getSnapshot();
    const first = window.__game.assertFeelContract();
    const second = window.__game.assertFeelContract();
    const after = window.__game.getSnapshot();

    return { before, first, second, after };
  });

  expect(result.first.passed).toBe(true);
  expect(result.second.passed).toBe(true);

  expect(result.after.player.x).toBeCloseTo(result.before.player.x, 6);
  expect(result.after.player.z).toBeCloseTo(result.before.player.z, 6);
  expect(result.after.player.facingRadians).toBeCloseTo(result.before.player.facingRadians, 6);

  expect(result.after.movement.input).toEqual(result.before.movement.input);
  expect(result.after.movement.lastStepMs).toBeCloseTo(result.before.movement.lastStepMs, 6);
  expect(result.after.movement.lastVelocityMetersPerSecond)
    .toBeCloseTo(result.before.movement.lastVelocityMetersPerSecond, 6);
});
