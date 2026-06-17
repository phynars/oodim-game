// Gameplay harness for Galaga — the scaffold floor plus the input slice (#31).
// These tests assert the load-bearing `window.__galaga` contract: that boot
// state is sane, that the fixed-step loop ticks once started, and (since #31)
// that the player fighter responds to horizontal input AND stays inside the
// playfield. Backlog slices ADD tests here (firing, the enemy formation,
// diving, collision/lives, scoring/stages, the boss capture beam + dual-
// fighter rescue, the challenging stage) — each new mechanic must ship with
// a failing-first assertion against `window.__galaga`, the same "CI for
// gameplay" discipline Pac-Man's e2e/pacman.spec.ts uses.

import { expect, test } from "@playwright/test";

import type { GameState } from "../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
  }
}

test("boots the state contract: ready, 3 lives, stage 1, player + field present", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));

  const s = await page.evaluate(() => window.__galaga!);
  expect(s.status).toBe("ready");
  expect(s.lives).toBe(3);
  expect(s.stage).toBe(1);
  expect(s.score).toBe(0);
  expect(s.player.alive).toBe(true);
  expect(s.player.captured).toBe(false);
  expect(s.player.dual).toBe(false);
  expect(s.field.width).toBeGreaterThan(0);
  expect(s.field.height).toBeGreaterThan(0);
  // Rosters exist (empty in the scaffold) so consumers can read them safely.
  expect(Array.isArray(s.enemies)).toBe(true);
  expect(Array.isArray(s.bullets)).toBe(true);
});

test("first input flips ready→playing and the fixed-step loop advances tick", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  expect(await page.evaluate(() => window.__galaga!.status)).toBe("ready");

  // Focus the canvas + send an input; the engine leaves READY on first input.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");

  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: 5000,
  });

  // The tick counter only advances while playing — prove the loop runs.
  const t1 = await page.evaluate(() => window.__galaga!.tick);
  await page.waitForFunction((t) => (window.__galaga?.tick ?? 0) > t, t1, {
    timeout: 5000,
  });
  const t2 = await page.evaluate(() => window.__galaga!.tick);
  expect(t2).toBeGreaterThan(t1);
});

test("player fighter moves left then right under keyboard input, clamped to the playfield", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__galaga));
  await page.locator("canvas").click();

  // Snapshot the spawn x (player starts at field.width / 2 per types.ts).
  const xSpawn = await page.evaluate(() => window.__galaga!.player.x);
  const fieldW = await page.evaluate(() => window.__galaga!.field.width);
  const ySpawn = await page.evaluate(() => window.__galaga!.player.y);

  // Hold ArrowLeft for ~250 ms — at PLAYER_SPEED=2.5px/tick * 60Hz that
  // covers ~37 px, plenty to drop below xSpawn. Wait for the move to land,
  // not a fixed sleep, so the test isn't flaky under slow CI.
  await page.keyboard.down("ArrowLeft");
  await page.waitForFunction(
    (x0) => (window.__galaga?.player.x ?? x0) < x0,
    xSpawn,
    { timeout: 5000 },
  );
  await page.keyboard.up("ArrowLeft");
  const xAfterLeft = await page.evaluate(() => window.__galaga!.player.x);
  expect(xAfterLeft).toBeLessThan(xSpawn);

  // Now hold ArrowRight long enough to cross back past xSpawn — proves
  // direction reverses and is symmetric.
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    (x0) => (window.__galaga?.player.x ?? 0) > x0,
    xSpawn,
    { timeout: 5000 },
  );
  await page.keyboard.up("ArrowRight");
  const xAfterRight = await page.evaluate(() => window.__galaga!.player.x);
  expect(xAfterRight).toBeGreaterThan(xAfterLeft);
  expect(xAfterRight).toBeGreaterThan(xSpawn);

  // y stays constant — horizontal-only along the bottom.
  const yNow = await page.evaluate(() => window.__galaga!.player.y);
  expect(yNow).toBe(ySpawn);

  // Bounds: hold ArrowLeft long enough to slam the left wall. PLAYER_SPEED
  // and the field are tiny, so ~1.5 s is plenty (320 px / 2.5 px/tick at
  // 60 Hz = ~2.1 s to cross the whole field; half-field from spawn is ~1.1 s).
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(1500);
  await page.keyboard.up("ArrowLeft");
  const xLeftWall = await page.evaluate(() => window.__galaga!.player.x);
  expect(xLeftWall).toBeGreaterThanOrEqual(0);
  expect(xLeftWall).toBeLessThanOrEqual(fieldW);
  // Hard against (or very near) the left edge — proves the clamp engaged.
  expect(xLeftWall).toBeLessThan(5);

  // And the right wall.
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(3000);
  await page.keyboard.up("ArrowRight");
  const xRightWall = await page.evaluate(() => window.__galaga!.player.x);
  expect(xRightWall).toBeGreaterThanOrEqual(0);
  expect(xRightWall).toBeLessThanOrEqual(fieldW);
  expect(xRightWall).toBeGreaterThan(fieldW - 5);
});
