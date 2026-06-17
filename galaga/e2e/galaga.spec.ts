// Gameplay harness for Galaga — the scaffold floor. These two tests assert
// the load-bearing `window.__galaga` contract boots and the fixed-step loop
// actually ticks once started. Backlog slices ADD tests here (ship movement,
// firing, the enemy formation, diving, collision/lives, scoring/stages, the
// boss capture beam + dual-fighter rescue, the challenging stage) — each new
// mechanic must ship with a failing-first assertion against `window.__galaga`,
// the same "CI for gameplay" discipline Pac-Man's e2e/pacman.spec.ts uses.

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
