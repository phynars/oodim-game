import { expect, test } from "@playwright/test";

test("movement feel probe stays non-destructive across repeated assertions", async ({ page }) => {
  await page.goto("/?slot=movement-feel-probe-idempotence");

  await page.waitForFunction(() => window.__game?.version === 1);

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
