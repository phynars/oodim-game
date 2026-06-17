// End-to-end harness for Pac movement + pellet eating.
//
// We dispatch a real ArrowRight keydown into the page and then poll
// `window.__pac` — that's the load-bearing contract. The assertions
// here are deliberately tight: x must increase, pellets must drop,
// score must rise. If any one of those breaks we want a red CI line
// pointing at *which* part of the loop regressed.

import { expect, test } from "@playwright/test";

import type { GameState } from "../src/game/types";

declare global {
  interface Window {
    __pac?: GameState;
  }
}

test("ArrowRight moves Pac, eats a pellet, and scores", async ({ page }) => {
  await page.goto("/");

  // Wait for the engine to publish state.
  await page.waitForFunction(() => Boolean(window.__pac));

  const before = await page.evaluate(() => {
    const s = window.__pac!;
    return { x: s.pac.x, y: s.pac.y, pellets: s.pellets, score: s.score };
  });

  // Focus the page so keydown lands on window.
  await page.locator("canvas").click();

  // Dispatch ArrowRight. The engine queues the direction and starts
  // motion on the next tick.
  await page.keyboard.press("ArrowRight");

  // Poll until Pac has moved at least one tile to the right AND a
  // pellet has been eaten. Generous timeout — at SPEED_PER_TICK = 0.12
  // and 60 ticks/sec, the first tile crossing lands well inside 1s,
  // and from the spawn (13, 23) the next pellet sits two tiles east.
  await page.waitForFunction(
    (b) => {
      const s = window.__pac;
      if (!s) return false;
      return s.pac.x > b.x && s.pellets < b.pellets && s.score > b.score;
    },
    before,
    { timeout: 5000 },
  );

  const after = await page.evaluate(() => {
    const s = window.__pac!;
    return { x: s.pac.x, y: s.pac.y, pellets: s.pellets, score: s.score };
  });

  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBe(before.y);
  expect(after.pellets).toBeLessThan(before.pellets);
  expect(after.score).toBeGreaterThanOrEqual(before.score + 10);
});

test("ghost roster exposes Blinky and the mode flips scatter→chase", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  // The engine boots ghosts in scatter (matches arcade); the scatter→chase
  // flip lands at MODE_PERIOD_TICKS = 300 ticks ≈ 5s. The roster is the
  // load-bearing contract from issue #4: name + valid mode.
  const initial = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      hasRoster: Array.isArray(s.ghosts),
      count: s.ghosts.length,
      first: s.ghosts[0],
    };
  });
  expect(initial.hasRoster).toBe(true);
  expect(initial.count).toBeGreaterThanOrEqual(1);
  expect(initial.first.name).toBe("blinky");
  expect(["scatter", "chase"]).toContain(initial.first.mode);

  // Focus the page so the engine has started ticking; otherwise we'd
  // be polling a paused tick counter and never see the mode flip.
  await page.locator("canvas").click();

  const startMode = initial.first.mode;
  // Wait for ANY mode change. With a 5s period and a 10s budget the
  // first flip is guaranteed once the rAF loop is live.
  await page.waitForFunction(
    (m) => {
      const s = window.__pac;
      if (!s || !s.ghosts || s.ghosts.length === 0) return false;
      return s.ghosts[0].mode !== m;
    },
    startMode,
    { timeout: 10_000 },
  );

  const finalState = await page.evaluate(() => {
    const s = window.__pac!;
    return { mode: s.ghosts[0].mode, x: s.ghosts[0].x, y: s.ghosts[0].y };
  });
  expect(["scatter", "chase"]).toContain(finalState.mode);
  expect(finalState.mode).not.toBe(startMode);
  // Sanity: tile coords stay on the grid.
  expect(Number.isInteger(finalState.x)).toBe(true);
  expect(Number.isInteger(finalState.y)).toBe(true);
});
