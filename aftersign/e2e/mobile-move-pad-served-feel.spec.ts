import { expect, test } from "@playwright/test";

const COLD_START_MS = 90_000;

test("mobile move pad drives the served avatar in one frame and releases clean", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/?slot=mobile-move-pad-served-feel");

  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: 60_000 });

  const pad = page.locator("#movePad");
  await expect(pad).toBeVisible();

  const box = await pad.boundingBox();
  expect(box).not.toBeNull();

  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;
  const start = await page.evaluate(() => window.__game.getSnapshot());

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 54, centerY, { steps: 1 });

  await page.waitForFunction(() => {
    const snapshot = window.__game?.getSnapshot();
    return Boolean(
      snapshot?.movement.fixedStepsLastFrame > 0 &&
        snapshot?.movement.input.source === "touch" &&
        snapshot?.movement.velocityX > 0,
    );
  }, undefined, { timeout: 5_000 });

  const moving = await page.evaluate(() => window.__game.getSnapshot());

  expect(moving.player.x).toBeGreaterThan(start.player.x);
  expect(moving.movement.input.source).toBe("touch");
  expect(moving.movement.velocityX).toBeGreaterThan(0);
  expect(moving.movement.fixedStepsLastFrame).toBeGreaterThan(0);
  expect(moving.movement.lastStepMs).toBeLessThanOrEqual(moving.movement.contract.targetFrameMs + 0.01);

  await page.mouse.up();
  await page.waitForFunction(() => {
    const snapshot = window.__game?.getSnapshot();
    return Boolean(snapshot?.movement.input.active === false && snapshot?.movement.input.source === "none");
  }, undefined, { timeout: 5_000 });

  const released = await page.evaluate(() => window.__game.getSnapshot());
  await expect(pad).toHaveAttribute("data-active", "false");
  expect(released.movement.input.active).toBe(false);
  expect(released.movement.input.source).toBe("none");
});
