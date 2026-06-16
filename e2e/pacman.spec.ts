import { test, expect } from "@playwright/test";
import type { GameState } from "../src/game/types";

// ── Gameplay verification harness ───────────────────────────────────────────
// A game's correctness is interactive — "does it compile" and "does the code
// read well" don't tell you whether Pac-Man actually plays. So gameplay PRs are
// gated HERE: drive the game, then assert on window.__pac (the state contract in
// src/game/types.ts) — no pixel scraping. This file starts with the boot
// contract; each gameplay issue adds the assertions for its mechanic
// (pellet decrement, ghost mode transitions, collision → life loss, win/lose).

function getState(page: import("@playwright/test").Page): Promise<GameState> {
  return page.evaluate(() => {
    const s = (window as unknown as { __pac?: GameState }).__pac;
    if (!s) throw new Error("window.__pac not initialized");
    return s;
  });
}

test("boots: canvas renders and the __pac state contract is initialized", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas#game")).toBeVisible();

  const s = await getState(page);
  expect(s.status).toBe("ready");
  expect(s.lives).toBe(3);
  expect(s.score).toBe(0);
});

test("game loop advances frames", async ({ page }) => {
  await page.goto("/");
  const f1 = (await getState(page)).frame;
  await page.waitForTimeout(250);
  const f2 = (await getState(page)).frame;
  expect(f2).toBeGreaterThan(f1);
});
