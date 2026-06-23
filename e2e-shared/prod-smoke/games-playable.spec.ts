import { test, expect } from "@playwright/test";

// Asserts each game is ACTUALLY PLAYABLE on the deployed site — not merely that
// the page returns 200. "merged + CI-green + deployed" is NOT "works for a user":
// the agar multiplayer server (EchoRoom DO) returned 404 in prod for ages while
// every artifact looked done. This smoke is the only gate that sees the running
// product as a player does.

// Static single-player games: a visible canvas means the client booted + rendered.
for (const game of ["pacman", "galaga", "doom"]) {
  test(`${game}: loads and renders a canvas`, async ({ page }) => {
    const resp = await page.goto(`/${game}/`);
    expect(resp?.status(), `${game} page must serve 200`).toBeLessThan(400);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 45_000 });
  });
}

// agar: server-authoritative multiplayer. The decisive check is that the world
// SIM ADVANCES — which only happens if the WebSocket to the EchoRoom DO actually
// upgrades. If /ws 404s (the incident), no snapshot arrives, tick stays 0, and
// this fails with a clear message instead of a silently-dead "playable" game.
test("agar: multiplayer is live — WS connects, world ticks, food + bots render", async ({ page }) => {
  await page.goto("/agar/");
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const g = window.__game;
      const c = (g && g.canonical) || {};
      const food = Array.isArray(c.food) ? c.food.length : 0;
      const bots = Array.isArray(c.bots) ? c.bots.length : 0;
      return !!g && g.tick > 5 && !!c.player && food > 0 && bots > 0;
    },
    null,
    { timeout: 45_000 },
  );
  const state = await page.evaluate(() => {
    const c = window.__game.canonical || {};
    return {
      tick: window.__game.tick,
      food: Array.isArray(c.food) ? c.food.length : 0,
      bots: Array.isArray(c.bots) ? c.bots.length : 0,
      hasPlayer: !!c.player,
    };
  });
  expect(state.tick, "agar sim must tick (WS connected, not 404)").toBeGreaterThan(5);
  expect(state.food, "food pellets must spawn").toBeGreaterThan(0);
  expect(state.bots, "AI bots must spawn").toBeGreaterThan(0);
  expect(state.hasPlayer, "player cell must exist").toBe(true);
});

// Minimal ambient typing for window.__game (the agar slice-3 test surface).
declare global {
  interface Window {
    __game: { tick: number; canonical?: { player?: unknown; food?: unknown[]; bots?: unknown[] } };
  }
}
