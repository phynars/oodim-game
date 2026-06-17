// End-to-end harness for Pac movement + pellet eating + ghost AI.
//
// We dispatch a real ArrowRight keydown into the page and then poll
// `window.__pac` — that's the load-bearing contract. The assertions
// here are deliberately tight: x must increase, pellets must drop,
// score must rise. If any one of those breaks we want a red CI line
// pointing at *which* part of the loop regressed.

import { expect, test } from "@playwright/test";

import type { GameState } from "../src/game/types";

// Shape of the in-browser unit-test bridge exposed by engine.ts. Each
// function is the same pure targeting fn imported from src/game/ghost.ts;
// the bridge lets us call them via page.evaluate with crafted inputs.
type Tile = { x: number; y: number };
type Dir = "none" | "up" | "down" | "left" | "right";
interface PacInternals {
  blinkyTarget: (pac: Tile) => Tile;
  pinkyTarget: (pac: Tile & { dir: Dir }) => Tile;
  inkyTarget: (pac: Tile & { dir: Dir }, blinky: Tile) => Tile;
  clydeTarget: (clyde: Tile, pac: Tile) => Tile;
  scatterTarget: (name: "blinky" | "pinky" | "inky" | "clyde") => Tile;
  forceGhostOntoPac: (name: "blinky" | "pinky" | "inky" | "clyde") => void;
}

declare global {
  interface Window {
    __pac?: GameState;
    __pacInternals?: PacInternals;
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

// Issue #5 — full ghost quartet. The roster contract grows to four named
// entries. This test FAILS on the pre-change code (which only spawns
// Blinky) and PASSES once spawnGhosts() returns all four.
test("ghost quartet — roster has Blinky, Pinky, Inky, Clyde", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  const roster = await page.evaluate(() => {
    const s = window.__pac!;
    return s.ghosts.map((g) => g.name);
  });

  expect(roster.length).toBe(4);
  // Set equality — order is engine-internal, but the four names are fixed.
  expect(new Set(roster)).toEqual(
    new Set(["blinky", "pinky", "inky", "clyde"]),
  );
});

// Issue #5 — per-ghost targeting unit tests, run in-browser via the
// __pacInternals bridge. Each ghost's targeting fn is pure; we feed it
// crafted inputs and assert the exact tile it returns. These cover each
// targeting function independently of the live engine state.
// Issue #6 — power pellets flip ghosts to 'frightened'.
//
// This test drives Pac from spawn (13, 23) around to the bottom-left
// power pellet at (1, 23) via the left-down corridor, then asserts that
// the moment the power pellet is eaten, at least one ghost reports
// `mode === 'frightened'` on the public roster.
//
// FAILS on the pre-change code (ghost mode is only 'scatter' | 'chase').
// PASSES once the engine arms FRIGHTENED_TICKS on power-pellet eat and
// tickGhost honors it.
test("power pellet flips ghosts to frightened mode", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  // Focus the canvas so keyboard input drives the engine.
  await page.locator("canvas").click();

  // Walk Pac to the bottom-left power pellet. The path is:
  //   (13,23) --Left-→ (6,23) --Up-→ (6,20) --Left-→ (1,20) --Down-→ (1,23)
  // We queue each turn only once Pac has reached the corner tile,
  // because the engine's pre-turn check only honors `queued` when the
  // neighbor in that direction is walkable. Doing it any earlier would
  // get ignored and the test would race.
  const reach = async (tile: { x: number; y: number }) =>
    page.waitForFunction(
      (t) => {
        const s = window.__pac;
        return Boolean(s) && s!.pac.x === t.x && s!.pac.y === t.y;
      },
      tile,
      { timeout: 15_000 },
    );

  await page.keyboard.press("ArrowLeft");
  await reach({ x: 6, y: 23 });

  await page.keyboard.press("ArrowUp");
  await reach({ x: 6, y: 20 });

  await page.keyboard.press("ArrowLeft");
  await reach({ x: 1, y: 20 });

  await page.keyboard.press("ArrowDown");

  // The power pellet sits at (1, 23). Once Pac arrives we expect at
  // least one ghost in 'frightened' mode within the very next ticks.
  await page.waitForFunction(
    () => {
      const s = window.__pac;
      if (!s) return false;
      // Power pellet is eaten on tile commit at (1, 23). Frightened
      // mode is arrived-at the same tick.
      return (
        s.pac.x === 1 &&
        s.pac.y === 23 &&
        s.ghosts.some((g) => g.mode === "frightened")
      );
    },
    null,
    { timeout: 15_000 },
  );

  const snapshot = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      pac: { x: s.pac.x, y: s.pac.y },
      modes: s.ghosts.map((g) => g.mode),
    };
  });
  expect(snapshot.pac).toEqual({ x: 1, y: 23 });
  expect(snapshot.modes).toContain("frightened");
});

test("ghost targeting — Blinky/Pinky/Inky/Clyde each compute distinct targets", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pacInternals));

  const results = await page.evaluate(() => {
    const api = window.__pacInternals!;
    return {
      // Blinky: targets Pac's current tile, full stop.
      blinky: api.blinkyTarget({ x: 10, y: 20 }),
      // Pinky: 4 tiles ahead of Pac in his facing direction.
      pinkyRight: api.pinkyTarget({ x: 10, y: 20, dir: "right" }),
      pinkyUp: api.pinkyTarget({ x: 10, y: 20, dir: "up" }),
      pinkyNone: api.pinkyTarget({ x: 10, y: 20, dir: "none" }),
      // Inky: double the Blinky→pivot vector, where pivot is 2 ahead of Pac.
      // Pac at (10,20) facing right → pivot (12,20). Blinky at (4,20) →
      // vector (8,0) → target (20,20).
      inky: api.inkyTarget({ x: 10, y: 20, dir: "right" }, { x: 4, y: 20 }),
      // Clyde: chase when far (>8 tiles), flee when close.
      clydeFar: api.clydeTarget({ x: 0, y: 30 }, { x: 20, y: 5 }),
      clydeClose: api.clydeTarget({ x: 5, y: 5 }, { x: 6, y: 6 }),
      clydeCorner: api.scatterTarget("clyde"),
    };
  });

  // Blinky.
  expect(results.blinky).toEqual({ x: 10, y: 20 });

  // Pinky.
  expect(results.pinkyRight).toEqual({ x: 14, y: 20 });
  expect(results.pinkyUp).toEqual({ x: 10, y: 16 });
  // 'none' direction → no offset.
  expect(results.pinkyNone).toEqual({ x: 10, y: 20 });

  // Inky.
  expect(results.inky).toEqual({ x: 20, y: 20 });

  // Clyde — far chases Pac directly; close returns the scatter corner.
  expect(results.clydeFar).toEqual({ x: 20, y: 5 });
  expect(results.clydeClose).toEqual(results.clydeCorner);
});

// Issue #7 — chase/scatter collision costs a life and resets positions.
//
// We force the overlap via the `forceGhostOntoPac` test hook: warping
// Blinky directly onto Pac's tile guarantees a same-tick collision
// regardless of where the live AI happens to have wandered. Without
// this hook the test would race the targeting heuristic on every CI
// machine.
//
// FAILS on the pre-change code (no collision handling — lives stays 3).
// PASSES once the engine decrements lives + resets on chase contact.
test("chase-mode ghost collision drops a life and resets Pac", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.waitForFunction(() => Boolean(window.__pacInternals));

  // Focus the canvas so the rAF loop is running and the engine is
  // actually ticking — the collision is detected inside update().
  await page.locator("canvas").click();

  const before = await page.evaluate(() => {
    const s = window.__pac!;
    return { lives: s.lives, status: s.status };
  });
  expect(before.lives).toBe(3);

  // Warp Blinky onto Pac. Blinky boots in 'scatter' (then flips to
  // 'chase' at tick 300); either mode is fatal — both are non-frightened.
  await page.evaluate(() => {
    window.__pacInternals!.forceGhostOntoPac("blinky");
  });

  // Wait for the collision to be processed on the next update tick.
  await page.waitForFunction(
    (b) => {
      const s = window.__pac;
      return Boolean(s) && s!.lives < b.lives;
    },
    before,
    { timeout: 3000 },
  );

  const after = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      lives: s.lives,
      status: s.status,
      pac: { x: s.pac.x, y: s.pac.y, dir: s.pac.dir },
    };
  });

  expect(after.lives).toBe(2);
  // Pac snapped back to spawn (13, 23) with no active direction.
  expect(after.pac).toEqual({ x: 13, y: 23, dir: "none" });
  // Still playable — not 'lost' yet.
  expect(after.status).not.toBe("lost");
});
