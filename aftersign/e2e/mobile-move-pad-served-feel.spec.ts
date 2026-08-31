import { expect, test } from "@playwright/test";

const COLD_START_MS = 90_000;

test("mobile move pad drives the served avatar in one frame and releases clean", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/?slot=mobile-move-pad-served-feel");

  await page.waitForFunction(() => window.__game?.version === 1, undefined, { timeout: 60_000 });

  const pad = page.locator("#movePad");
  // Explicit 30s bound — the default `expect` timeout is 5000ms, which
  // has flaked on cold aftersign boot even after the sibling
  // waitForFunction bounds below were widened to 30s. See PR #1551
  // review 4 comment thread — a 5s expect right after the game.version
  // gate can still race a slow SwiftShader first frame.
  await expect(pad).toBeVisible({ timeout: 30_000 });

  const box = await pad.boundingBox();
  expect(box).not.toBeNull();

  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;

  // The pad must OWN its own center point. The bottom .hud panel paints
  // above the pad and its .controls re-enable pointer-events, so a
  // beat's dialogue/tray content growing the panel over the pad leaves
  // the pad visible (toBeVisible passes) but dead — every tap lands on
  // the controls and the touch-intent poll below times out with no
  // signal about why. That exact regression shipped in PR #1555 (the
  // offered-jobs route/risk copy) and burned 7 blind review rounds as
  // presumed SwiftShader flake. elementFromPoint names the thief
  // directly instead.
  const tapPointOwner = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return {
        padOwnsPoint: Boolean(el?.closest("#movePad")),
        actualOwner: el ? `${el.tagName.toLowerCase()}#${el.id || "(no id)"}.${el.className || "(no class)"}` : "(nothing)",
      };
    },
    [centerX, centerY] as const,
  );
  expect(
    tapPointOwner.padOwnsPoint,
    `the move pad's center must be tappable — hit ${tapPointOwner.actualOwner} instead (is the .hud panel covering the pad?)`,
  ).toBe(true);

  const start = await page.evaluate(() => window.__game.getSnapshot());

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 54, centerY, { steps: 1 });

  // SwiftShader cold-start latency (#700/#506/#590/#766): the first
  // pointerdown after `page.goto` has to travel through the fixed-step
  // simulator on the very first frame budget the renderer allocates.
  // On CI hosts the initial rAF cadence can jitter past a tight 5s
  // wait even though everything downstream is healthy — surrounding
  // specs in this lane use `WAIT_MS = 10_000` for the same reason.
  // Widening the poll to 30s absorbs that variance without hiding a
  // real regression: the outer `COLD_START_MS = 90_000` still bounds
  // the whole spec.
  await page.waitForFunction(() => {
    const snapshot = window.__game?.getSnapshot();
    return Boolean(
      snapshot?.movement.fixedStepsLastFrame > 0 &&
        snapshot?.movement.input.source === "touch" &&
        snapshot?.movement.velocityX > 0,
    );
  }, undefined, { timeout: 30_000 });

  const moving = await page.evaluate(() => window.__game.getSnapshot());

  expect(moving.player.x).toBeGreaterThan(start.player.x);
  expect(moving.movement.input.source).toBe("touch");
  expect(moving.movement.velocityX).toBeGreaterThan(0);
  expect(moving.movement.fixedStepsLastFrame).toBeGreaterThan(0);
  expect(moving.movement.lastStepMs).toBeLessThanOrEqual(moving.movement.contract.targetFrameMs + 0.01);

  await page.mouse.up();
  // Same SwiftShader cold-start reasoning as the intent-poll above:
  // release-clean settles on the next fixed step, which can jitter
  // past a 5s bound on a cold host. 30s absorbs the variance; the
  // 90s outer test timeout still bounds the whole spec.
  await page.waitForFunction(() => {
    const snapshot = window.__game?.getSnapshot();
    return Boolean(snapshot?.movement.input.active === false && snapshot?.movement.input.source === "none");
  }, undefined, { timeout: 30_000 });

  const released = await page.evaluate(() => window.__game.getSnapshot());
  // Same 30s bound as the initial `toBeVisible` above — a cold host
  // can jitter this attribute-flip past the default 5s.
  await expect(pad).toHaveAttribute("data-active", "false", { timeout: 30_000 });
  expect(released.movement.input.active).toBe(false);
  expect(released.movement.input.source).toBe("none");
});
