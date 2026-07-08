import { expect, test } from "@playwright/test";

test("movement feel contract stays within one-frame response budget", async ({ page }) => {
  await page.goto("/?slot=movement-feel-contract");

  await page.waitForFunction(() => window.__game?.version === 1);

  const result = await page.evaluate(() => window.__game.assertFeelContract());

  expect(result.passed).toBe(true);
  expect(result.movedThisFrame).toBe(true);
  expect(result.fixedStepInsideBudget).toBe(true);
  expect(result.inputToVelocityFrames).toBe(1);
  expect(result.lastStepMs).toBeLessThanOrEqual(result.targetFrameMs + 0.01);
});
