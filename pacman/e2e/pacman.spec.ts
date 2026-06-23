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
  forceGhostOntoPac: (
    name: "blinky" | "pinky" | "inky" | "clyde",
    mode?: "frightened" | "chase",
  ) => void;
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

// Issue #295 — arcade canon: free life at 10,000 points.
//
// Score climbs past 10k on the pellet-eat path. The threshold fires ONCE
// per game: `lives` goes 3→4, `extraLifeAwarded` latches true, the EXTRA
// banner countdown arms. A second pellet at score 10010 does NOT
// re-trigger — the latch holds.
//
// We warp `__pac.score = 9990` directly (it's a live mutable reference)
// rather than driving 999 real pellet eats. Then queue ArrowRight; the
// next pellet eat lands on the threshold-crossing tick.
//
// FAILS on the pre-change code (no `extraLifeAwarded` field, no lives
// bump path). PASSES once tickPac wires the threshold check.
test("score crossing 10,000 awards a free life and fires the EXTRA banner (one-shot)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  await page.locator("canvas").click();

  // Reset Pac to a known east-facing pellet-rich slice. Spawn (13, 23)
  // has a pellet two tiles east. Warp the score to 9990 BEFORE the
  // first ArrowRight commit so the very next pellet (worth 10) lands
  // the score at exactly 10000.
  await page.evaluate(() => {
    const s = window.__pac!;
    s.score = 9990;
  });

  const before = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      score: s.score,
      lives: s.lives,
      awarded: s.extraLifeAwarded,
      banner: s.extraLifeBanner,
    };
  });
  expect(before.score).toBe(9990);
  expect(before.lives).toBe(3);
  expect(before.awarded).toBe(false);
  expect(before.banner).toBe(0);

  // Drive Pac east — the threshold-crossing pellet sits just ahead.
  await page.keyboard.press("ArrowRight");

  // Wait for the threshold to fire. We poll on the latch flipping true,
  // which is the load-bearing single signal — the engine writes lives++
  // and banner=90 in the SAME tick, so observing `awarded === true`
  // means all three writes have landed.
  await page.waitForFunction(
    () => Boolean(window.__pac?.extraLifeAwarded),
    null,
    { timeout: 5000 },
  );

  const after = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      score: s.score,
      lives: s.lives,
      awarded: s.extraLifeAwarded,
      banner: s.extraLifeBanner,
    };
  });
  expect(after.score).toBeGreaterThanOrEqual(10000);
  expect(after.lives).toBe(4);
  expect(after.awarded).toBe(true);
  // Banner is armed (90 at the crossing tick; may have decayed a few
  // ticks by the time we poll, but must still be > 0 well inside 5s).
  expect(after.banner).toBeGreaterThan(0);

  // HUD mirrors the bumped lives.
  await expect(page.locator('[data-hud="lives"]')).toHaveText("4");

  // One-shot: eat a second pellet past 10000 and confirm `lives` does
  // NOT bump again. We snapshot the lives + awarded state, let Pac
  // continue east through the next pellet, and re-read. Lives must
  // stay at 4 and the latch must stay true.
  const livesAtLatch = after.lives;
  const scoreAtLatch = after.score;
  await page.waitForFunction(
    (s) => (window.__pac?.score ?? 0) > s,
    scoreAtLatch,
    { timeout: 5000 },
  );
  const afterSecondEat = await page.evaluate(() => {
    const s = window.__pac!;
    return { lives: s.lives, awarded: s.extraLifeAwarded };
  });
  expect(afterSecondEat.lives).toBe(livesAtLatch);
  expect(afterSecondEat.awarded).toBe(true);
});

// Issue #138 — pellet-pickup juice surfaces via the `feedback` channel.
//
// We drive Pac east from spawn until a pellet is eaten, then snapshot
// `state.feedback` on that same tick. The acceptance gate (per #138):
//   • pacSquash >= 0.10  (regular pellet pops to 0.12)
//   • popups: one entry, value 10, ageTicks 0
//   • sparkles: 4 entries, ageTicks 0
//   • flashAlpha === 0   (regular pellet does NOT flash)
//
// FAILS on the pre-change code (no `feedback` field on GameState).
// PASSES once tickPac writes the channel on the eat-event.
test("pellet pickup writes feedback channel (squash + popup + sparkles)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  const beforeScore = await page.evaluate(() => window.__pac!.score);

  await page.locator("canvas").click();
  await page.keyboard.press("ArrowRight");

  // Poll until a pellet is eaten AND grab the same-tick feedback snapshot
  // atomically — the engine decays the channel each subsequent update(),
  // so a two-call (wait then evaluate) split could let pacSquash slip
  // below the acceptance floor between the predicate and the read. We
  // return the snapshot directly from the predicate; `evaluateHandle`
  // gives us the JSHandle then `jsonValue()` materialises it.
  const handle = await page.waitForFunction(
    (b) => {
      const s = window.__pac;
      if (!s || !s.feedback) return null;
      if (s.score < b + 10) return null;
      const fb = s.feedback;
      if (fb.popups.length < 1 || fb.sparkles.length < 4) return null;
      return {
        score: s.score,
        pacSquash: fb.pacSquash,
        flashAlpha: fb.flashAlpha,
        popup0: fb.popups[0],
        popupCount: fb.popups.length,
        sparkleCount: fb.sparkles.length,
      };
    },
    beforeScore,
    { timeout: 5000 },
  );
  const snapshot = (await handle.jsonValue()) as {
    score: number;
    pacSquash: number;
    flashAlpha: number;
    popup0: { x: number; y: number; value: number; ageTicks: number };
    popupCount: number;
    sparkleCount: number;
  };

  // Score climbed by 10 → ate a regular pellet (not the power pellet path).
  expect(snapshot.score - beforeScore).toBe(10);
  // Squash popped to >=0.10 (spec floor; engine writes 0.12).
  expect(snapshot.pacSquash).toBeGreaterThanOrEqual(0.1);
  // Regular pellet → no screen flash.
  expect(snapshot.flashAlpha).toBe(0);
  // Exactly one popup landed this eat, value matches scoring.
  expect(snapshot.popupCount).toBe(1);
  expect(snapshot.popup0.value).toBe(10);
  // Four sparkles per regular pellet.
  expect(snapshot.sparkleCount).toBe(4);
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

  // Focus the page and press a direction so the engine leaves the
  // READY! state and begins ticking ghosts; otherwise we'd be polling
  // a paused mode timer and never see the flip. (Issue #8: 'ready'
  // holds until first input.)
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowLeft");

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
  // Per issue #8, update() is gated on first input until status flips
  // to 'playing', so press a direction to unfreeze the simulation.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowUp");

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

// Issue #9 — touch controls in a mobile viewport.
//
// Drives a swipe-right gesture via touch events on the canvas and
// asserts Pac actually moved. FAILS on the pre-change code (which
// only binds keyboard) and PASSES once bindInput routes touch
// gestures through the same direction-queue path.
//
// Uses a fresh Playwright context with `hasTouch: true` + a mobile
// viewport so TouchEvent dispatches and CSS pointer:coarse rules
// apply. We synthesize the gesture with CDP-level
// `dispatchTouchEvent` because page.touchscreen.tap() doesn't
// emit start/end pairs separated by a drag.
test("mobile swipe-right moves Pac across at least one tile", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 13 portrait
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__pac));

    const before = await page.evaluate(() => {
      const s = window.__pac!;
      return { x: s.pac.x, y: s.pac.y };
    });

    // Locate the canvas to derive the swipe coordinates.
    const canvas = page.locator("#game");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas has no bounding box");
    const startX = box.x + box.width * 0.3;
    const startY = box.y + box.height * 0.5;
    const endX = box.x + box.width * 0.7;
    const endY = startY;

    // Synthesize a swipe: touchstart at the left, drag to the right,
    // release. Playwright's CDP `Input.dispatchTouchEvent` is the
    // path that actually fires TouchEvents on the page (the higher-
    // level page.touchscreen helpers don't expose start/move/end as
    // separate steps).
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y: startY }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: (startX + endX) / 2, y: startY }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: endX, y: endY }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    // Wait for the engine to consume the queued direction and move
    // Pac at least one tile east.
    await page.waitForFunction(
      (b) => {
        const s = window.__pac;
        return Boolean(s) && s!.pac.x > b.x;
      },
      before,
      { timeout: 5000 },
    );

    const after = await page.evaluate(() => {
      const s = window.__pac!;
      return { x: s.pac.x, y: s.pac.y };
    });
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBe(before.y);
  } finally {
    await context.close();
  }
});

// Issue #10 — HUD visibility.
//
// The HUD is a DOM strip above the canvas with three cells —
// score / lives / level — wired in main.ts off `window.__pac`. The
// `[data-hud]` attributes are the load-bearing contract: e2e reads
// them, never the visual rendering.
//
// FAILS on the pre-change code (no `[data-hud]` elements existed).
// PASSES once index.html ships the HUD strip and main.ts mirrors state
// into it.
test("HUD renders score/lives/level and score climbs as Pac eats", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  // The three HUD cells must exist and be visible from boot.
  const scoreEl = page.locator('[data-hud="score"]');
  const livesEl = page.locator('[data-hud="lives"]');
  const levelEl = page.locator('[data-hud="level"]');
  await expect(scoreEl).toBeVisible();
  await expect(livesEl).toBeVisible();
  await expect(levelEl).toBeVisible();

  // Boot values: 0 score, 3 lives, level 1. The HUD mirrors state via
  // rAF, so wait a beat to let the first frame paint.
  await expect(scoreEl).toHaveText("0");
  await expect(livesEl).toHaveText("3");
  await expect(levelEl).toHaveText("1");

  // Drive Pac so the score increments, then assert the HUD picks it up.
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => (window.__pac?.score ?? 0) > 0, null, {
    timeout: 5000,
  });

  // Read the HUD text and parse it as an integer — must be > 0.
  const hudScore = await scoreEl.evaluate(
    (el) => Number.parseInt(el.textContent ?? "0", 10) || 0,
  );
  expect(hudScore).toBeGreaterThan(0);
});

// Issue #10 — game-over overlay + HUD lives drain to 0.
//
// Drives Blinky onto Pac three times via the `forceGhostOntoPac` test
// hook to drain lives from 3 → 0, then asserts the engine flips status
// to 'lost' (the canvas paints "GAME OVER" — we assert on the load-
// bearing state contract, since pixel reads on canvas are too flaky
// across rendering backends).
//
// FAILS on the pre-change code (no test exercised the lives=0 path
// through to the GAME OVER overlay).
// PASSES once the engine + HUD wire-up holds end-to-end.
test("game-over overlay fires after lives reach zero and HUD reflects it", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.waitForFunction(() => Boolean(window.__pacInternals));

  // Unfreeze the simulation (issue #8 — update() is gated on first input).
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowUp");

  // Kill Pac three times. Between each kill we wait for the engine to
  // observe the new lives count before launching the next warp — if we
  // fire all three back-to-back, the second + third warps would land
  // on the same tick and only count once.
  for (let i = 3; i >= 1; i -= 1) {
    const targetLives = i - 1;
    await page.evaluate(() => {
      window.__pacInternals!.forceGhostOntoPac("blinky");
    });
    await page.waitForFunction(
      (t) => (window.__pac?.lives ?? -1) === t,
      targetLives,
      { timeout: 5000 },
    );
  }

  // After the third death, status flips to 'lost' and the engine paints
  // the GAME OVER overlay on the canvas.
  await page.waitForFunction(() => window.__pac?.status === "lost", null, {
    timeout: 3000,
  });

  const after = await page.evaluate(() => {
    const s = window.__pac!;
    return { status: s.status, lives: s.lives };
  });
  expect(after.status).toBe("lost");
  expect(after.lives).toBe(0);

  // HUD must mirror the zeroed lives.
  await expect(page.locator('[data-hud="lives"]')).toHaveText("0");
});

// Issue #8 — level-win state.
//
// We use the `clearPellets` test hook to zero out the pellet field in
// one step (eating every dot live would race the ghost AI on slow CI).
// On the next update() tick the engine sees pellets <= 0 and flips
// status to 'won', also refilling the pellet field for the next level.
//
// FAILS on the pre-change code (no 'won' status, no level-reset path).
// PASSES once the engine wires the win check + level reset.
test("clearing all pellets sets status='won' and refills the pellet field", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.waitForFunction(() => Boolean(window.__pacInternals));

  // Focus the canvas so the rAF loop is running — without this, the
  // engine is constructed but no update() ticks fire, and the win
  // check never runs.
  await page.locator("canvas").click();

  // Press a direction so the READY! overlay gives way to 'playing' —
  // the win check is gated on status === 'playing'.
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 5000,
  });

  const beforePelletTotal = await page.evaluate(() => window.__pac!.pellets);
  expect(beforePelletTotal).toBeGreaterThan(0);

  // Drop the floor out from under the level — zero pellets remaining.
  await page.evaluate(() => {
    window.__pacInternals!.clearPellets();
  });

  // Wait for the engine to observe the win condition and flip status.
  await page.waitForFunction(() => window.__pac?.status === "won", null, {
    timeout: 3000,
  });

  const after = await page.evaluate(() => {
    const s = window.__pac!;
    return { status: s.status, pellets: s.pellets };
  });
  expect(after.status).toBe("won");
  // Pellet field reset for the next level — the count is back at the
  // boot total (we don't expose it directly, but it must be > 0 and
  // match what we captured before clearing).
  expect(after.pellets).toBe(beforePelletTotal);
});

// Issue #150 — frightened-ghost-eat juice (hitstop + big squash +
// escalating popup + radial sparkle burst).
//
// We force a frightened ghost onto Pac via the extended
// `forceGhostOntoPac(name, "frightened")` hook, then on the very
// next collision tick snapshot the feedback channel. The acceptance
// gate:
//   • feedback.hitstopTicks === 3        (3-frame freeze on the eat)
//   • feedback.pacSquash === 0.30        (bigger than power-pellet's
//                                         0.25 — eat is louder than
//                                         activation)
//   • feedback.popups contains one popup with value 200 at the eaten
//     tile (first frightened eat in this window → +200)
//   • feedback.sparkles.length === 16    (radial burst, fully
//                                         deterministic — no flake)
//   • feedback.flashAlpha === 0          (eat does NOT flash; the
//                                         flash belongs to the
//                                         activation, not the kill)
//   • score climbed by exactly 200       (the receipt)
//
// FAILS on the pre-change code (no hitstopTicks field, no juice in
// the ghost-eat branch). PASSES once engine + types ship the channel
// writes.
test("frightened-ghost eat writes hitstop + big squash + popup + 16 sparkles", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));
  await page.waitForFunction(() => Boolean(window.__pacInternals));

  // Unfreeze the sim (issue #8 — update() gated on first input).
  await page.locator("canvas").click();
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => window.__pac?.status === "playing", null, {
    timeout: 5000,
  });

  const beforeScore = await page.evaluate(() => window.__pac!.score);

  // Force Blinky onto Pac in frightened mode. The next update() tick
  // resolves the collision through the eat branch, writes the juice,
  // and (because hitstopTicks=3 lands on the same tick) immediately
  // begins the 3-tick freeze. We snapshot atomically inside
  // waitForFunction so we observe the channel BEFORE any decay can
  // touch it.
  await page.evaluate(() => {
    window.__pacInternals!.forceGhostOntoPac("blinky", "frightened");
  });

  const handle = await page.waitForFunction(
    (b) => {
      const s = window.__pac;
      if (!s || !s.feedback) return null;
      if (s.score < b + 200) return null;
      const fb = s.feedback;
      // Wait for the eat to have landed all four channel writes.
      if (fb.sparkles.length < 16) return null;
      if (fb.popups.length < 1) return null;
      return {
        score: s.score,
        hitstopTicks: fb.hitstopTicks,
        pacSquash: fb.pacSquash,
        flashAlpha: fb.flashAlpha,
        sparkleCount: fb.sparkles.length,
        popupCount: fb.popups.length,
        popup0: fb.popups[0],
      };
    },
    beforeScore,
    { timeout: 5000 },
  );
  const snap = (await handle.jsonValue()) as {
    score: number;
    hitstopTicks: number;
    pacSquash: number;
    flashAlpha: number;
    sparkleCount: number;
    popupCount: number;
    popup0: { x: number; y: number; value: number; ageTicks: number };
  };

  // Score: exactly +200 (first frightened eat in this window).
  expect(snap.score - beforeScore).toBe(200);
  // Hitstop: 3 frames written on the eat. The gate at the top of
  // update() decrements ONCE per tick and returns early, so we may
  // sample anywhere in {3, 2, 1} depending on how many ticks have
  // elapsed between the eat and the rAF poll. The contract is "non-
  // zero hitstop is observable on the eat" — that's what the gate
  // proves. Bounds: 1..3 inclusive.
  expect(snap.hitstopTicks).toBeGreaterThanOrEqual(1);
  expect(snap.hitstopTicks).toBeLessThanOrEqual(3);
  // Squash: 0.30 written; same-tick read sees full amplitude because
  // decay runs BEFORE writes (#138 ordering). The hitstop gate also
  // short-circuits the decay path on subsequent frozen ticks, so the
  // value stays at 0.30 across the freeze. Floor at 0.28 for any
  // sampling drift.
  expect(snap.pacSquash).toBeGreaterThanOrEqual(0.28);
  // No screen flash on the eat (the flash belongs to power-pellet
  // activation, not to the kill it earned).
  expect(snap.flashAlpha).toBe(0);
  // Exactly 16 sparkles — the deterministic radial burst. This is the
  // load-bearing flake-proof assertion: angles are seeded by the eat
  // streak, count is fixed, no rAF jitter can change it.
  expect(snap.sparkleCount).toBe(16);
  // Popup: +200 receipt at the eaten tile.
  expect(snap.popupCount).toBeGreaterThanOrEqual(1);
  expect(snap.popup0.value).toBe(200);
});

// Issue #305 — arcade-canon mid-level give-to-player beat.
//
// Pac-Man's only mid-level give beat: a fruit appears under the ghost
// house when the dot-counter crosses 70 (then again at 170), lingers
// for ~2s, and pays a per-level canon score on overlap.
//
// We warp `__pac.dotsEaten = 69` directly (the field is a writable
// runtime mirror — same shape the EXTRA test uses for `score`),
// drive Pac east through one pellet, and assert:
//   • `state.fruit.active`-equivalent: `state.fruit !== null` after the
//     crossing tick, at (FRUIT_SPAWN_X, FRUIT_SPAWN_Y) with a finite
//     `ticksRemaining` and the canon level-1 value (100 = cherry).
//   • The banner countdown `fruitBanner` is > 0 (the FRUIT banner is
//     armed). The literal string is owned by the render layer; the
//     state contract is the load-bearing signal that the engine wants
//     to paint it.
//   • A second pellet does NOT re-arm fruit (the per-level latch holds).
//
// FAILS on the pre-change code (no `fruit`, `dotsEaten`, or
// `fruitBanner` fields). PASSES once tickPac/engine wire the threshold.
test("fruit arms on the 70-dot cross with banner countdown (one-shot per threshold)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__pac));

  await page.locator("canvas").click();

  // Warp dotsEaten to 69. The very next pellet eat lands the counter
  // at 70 — the canon first fruit threshold. We also clear any
  // residual fruit state (defensive — initialState() seeds it null
  // but a future change in boot ordering shouldn't break this test).
  await page.evaluate(() => {
    const s = window.__pac!;
    s.dotsEaten = 69;
    s.fruit = null;
    s.fruitBanner = 0;
    s.fruitSpawnsThisLevel = 0;
  });

  const before = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      dotsEaten: s.dotsEaten,
      fruit: s.fruit,
      banner: s.fruitBanner,
    };
  });
  expect(before.dotsEaten).toBe(69);
  expect(before.fruit).toBeNull();
  expect(before.banner).toBe(0);

  // Drive Pac east — from spawn (13, 23) the next pellet sits two
  // tiles east. Eating it crosses the 70-dot threshold and arms the
  // fruit on the same synchronous tick.
  await page.keyboard.press("ArrowRight");

  // Wait for the engine to arm the fruit. The load-bearing single
  // signal is `state.fruit !== null` — the engine writes fruit +
  // fruitBanner + fruitSpawnsThisLevel atomically in tickPac.
  await page.waitForFunction(
    () => window.__pac?.fruit !== null,
    null,
    { timeout: 5000 },
  );

  const after = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      dotsEaten: s.dotsEaten,
      fruit: s.fruit,
      banner: s.fruitBanner,
      spawnsThisLevel: s.fruitSpawnsThisLevel,
    };
  });
  expect(after.dotsEaten).toBeGreaterThanOrEqual(70);
  expect(after.fruit).not.toBeNull();
  // Sprite sits on the canon spawn tile.
  expect(after.fruit!.x).toBe(13);
  expect(after.fruit!.y).toBe(17);
  // Level 1 canon value: 100 (cherry).
  expect(after.fruit!.value).toBe(100);
  expect(after.fruit!.kind).toBe("cherry");
  // Lifetime arms to a positive countdown.
  expect(after.fruit!.ticksRemaining).toBeGreaterThan(0);
  // Banner arms (the engine wants to paint FRUIT in the slot).
  expect(after.banner).toBeGreaterThan(0);
  // First spawn this level.
  expect(after.spawnsThisLevel).toBe(1);

  // One-shot per threshold: eat another pellet (still well below 170)
  // and confirm the fruit state isn't re-armed. We snapshot the
  // current fruit reference (compare by ticksRemaining: it must
  // decrease, not reset to FRUIT_LIFETIME_TICKS).
  const beforeSecond = after.fruit!.ticksRemaining;
  // Continue east so we eat another pellet (dotsEaten goes 70 → 71).
  await page.waitForFunction(
    (b) => (window.__pac?.dotsEaten ?? 0) > b,
    after.dotsEaten,
    { timeout: 5000 },
  );
  const afterSecond = await page.evaluate(() => {
    const s = window.__pac!;
    return {
      dotsEaten: s.dotsEaten,
      fruit: s.fruit,
      spawnsThisLevel: s.fruitSpawnsThisLevel,
    };
  });
  expect(afterSecond.dotsEaten).toBeGreaterThan(after.dotsEaten);
  // Still exactly one spawn — the latch holds for this threshold.
  expect(afterSecond.spawnsThisLevel).toBe(1);
  // Fruit is still on the board (or was eaten — but it wasn't
  // re-armed). If non-null, ticksRemaining must have only decreased.
  if (afterSecond.fruit) {
    expect(afterSecond.fruit.ticksRemaining).toBeLessThanOrEqual(beforeSecond);
  }
});
