import { expect, test, type Page } from "@playwright/test";

// Served coverage for aftersign/src/runtime/runtimeLoop.js: the injected
// per-frame callback from aftersign/main.js must keep running every browser
// frame, so held keyboard input keeps moving the avatar across frames, and the
// loop restarts after a real reload.
const BOOT_WAIT_MS = 60_000;
const STEP_WAIT_MS = 15_000;

type Snapshot = {
  player: { x: number; z: number };
  movement: { input: { active: boolean; source: string } };
};

const snapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: { getSnapshot: () => Snapshot } }).__game.getSnapshot());

const boot = async (page: Page) => {
  await page.waitForFunction(
    () => typeof (window as unknown as { __game?: { getSnapshot?: unknown } }).__game?.getSnapshot === "function",
    undefined,
    { timeout: BOOT_WAIT_MS },
  );
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: BOOT_WAIT_MS });
};

const holdAndExpectMovement = async (page: Page) => {
  const before = await snapshot(page);
  await page.locator("canvas").first().click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
  await page.keyboard.down("KeyD");
  try {
    // Several successive frames must each advance the avatar: proves the
    // loop reschedules itself rather than running once.
    let last = before.player.x;
    for (let i = 0; i < 3; i += 1) {
      await expect
        .poll(async () => (await snapshot(page)).player.x, { timeout: STEP_WAIT_MS })
        .toBeGreaterThan(last);
      last = (await snapshot(page)).player.x;
    }
    const moving = await snapshot(page);
    expect(moving.movement.input.source).toBe("keyboard");
  } finally {
    await page.keyboard.up("KeyD");
  }
  await expect
    .poll(async () => (await snapshot(page)).movement.input.active, { timeout: STEP_WAIT_MS })
    .toBe(false);
};

test("runtime loop advances the avatar every frame under held key input and restarts after reload", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto(`/aftersign/?slot=runtime-loop-frames-${Date.now()}`);
  await boot(page);
  await holdAndExpectMovement(page);

  await page.reload();
  await boot(page);
  await holdAndExpectMovement(page);
});
