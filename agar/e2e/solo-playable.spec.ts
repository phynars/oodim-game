import { test, expect } from "@playwright/test";

// agar — single-player (solo) playability gate.
//
// The user report this fix answers: "I can't play agar, it doesn't grow
// or eat others." Root cause: the only client was the WS multiplayer
// renderer, and the EchoRoom Durable Object that feeds it is dev-only
// (never deployed) — so the live game showed "no one is listening" with
// zero gameplay. The fix runs the proven pure reducer LOCALLY as the
// DEFAULT /agar/ experience (no server). This spec proves that default
// is actually playable: the player MOVES, GROWS by eating food, and
// EATS a smaller cell.
//
// Drive surface: window.__agarSolo = { mass(), bestMass(), tick(),
// setDir(dir), step(n), self(), deaths() }. Stepping is synchronous and
// deterministic (no rAF / wall-clock dependency), so every wait below
// is a state-quiesced waitForFunction — no waitForTimeout, satisfying
// the no-wall-clock-waits guard.

const PLAYER_MASS_START = 16; // mirrors reducer PLAYER_MASS_START

// Solo is the DEFAULT mode — bare /agar/ (no ?mp=1) loads the local
// reducer client. A fixed seed keeps food/bot layout reproducible.
const SOLO_URL = "/agar/?seed=12345";

test("solo: window.__agarSolo + canonical world are installed on the default page", async ({
  page,
}) => {
  await page.goto(SOLO_URL, { waitUntil: "domcontentloaded" });

  await page.waitForFunction(
    () =>
      typeof (window as unknown as { __agarSolo?: unknown }).__agarSolo ===
        "object" &&
      (window as unknown as { __agarSolo?: unknown }).__agarSolo !== null,
    null,
    { timeout: 5000 },
  );

  const shape = await page.evaluate(() => {
    const s = (window as unknown as { __agarSolo: Record<string, unknown> })
      .__agarSolo;
    const g = (window as unknown as { __game: Record<string, unknown> }).__game;
    const canonical = g.canonical as {
      players?: unknown[];
      food?: unknown[];
      bots?: unknown[];
    };
    return {
      hasMass: typeof s.mass === "function",
      hasStep: typeof s.step === "function",
      hasSetDir: typeof s.setDir === "function",
      startMass: (s.mass as () => number)(),
      players: Array.isArray(canonical.players) ? canonical.players.length : 0,
      food: Array.isArray(canonical.food) ? canonical.food.length : 0,
      bots: Array.isArray(canonical.bots) ? canonical.bots.length : 0,
    };
  });

  expect(shape.hasMass).toBe(true);
  expect(shape.hasStep).toBe(true);
  expect(shape.hasSetDir).toBe(true);
  // A controllable player + a populated world exist from frame 1.
  expect(shape.players, "player cell present").toBe(1);
  expect(shape.food, "food pellets present").toBeGreaterThan(0);
  expect(shape.bots, "AI bots present").toBeGreaterThan(0);
  expect(shape.startMass, "player starts at PLAYER_MASS_START").toBe(
    PLAYER_MASS_START,
  );
});

test("solo: the player GROWS by eating food — mass rises above the start", async ({
  page,
}) => {
  await page.goto(SOLO_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as { __agarSolo?: unknown }).__agarSolo,
    null,
    { timeout: 5000 },
  );

  // DETERMINISTIC by construction (was flaky on slow CI): the old test
  // drove the player around HOPING it wandered onto one of the 40
  // scattered pellets within a 20s window. On a slow headless CI box it
  // could thread between them → mass never rose → timeout/fail (passed
  // only on faster machines). Instead, mirror the line-146 eat-a-cell
  // test: seed pellets at a KNOWN location the player provably reaches,
  // then step a fixed number of ticks. No clock dependence, no
  // reachability gamble.
  //
  // Mechanics (server/reducer.ts step()): with dir "none" the player
  // doesn't move (nx=x, ny=y) and then eats every pellet within
  // radiusForMass(mass)+FOOD_R of its center; each adds +1. BUT every
  // tick also applies a -1 DECAY to any above-start cell (applyDecay),
  // so eating a single pellet nets to zero. We therefore stack a BATCH
  // of pellets on the player in one tick: eating BATCH of them gives
  // +BATCH, minus the -1 decay = a net, deterministic +(BATCH-1) gain
  // per step. Repeating this over several steps grows the cell well
  // above the start. (This is the same reason the line-146 eat-a-cell
  // test grows: a whole cell adds >=8 in one tick, dwarfing decay.)
  const BATCH = 6; // pellets eaten per tick → net +(BATCH-1) after decay
  const STEPS = 4; // repeat for unambiguous, monotonic growth
  const result = await page.evaluate(
    ({ batch, steps }) => {
      type Solo = {
        mass: () => number;
        setDir: (d: string) => void;
        step: (n: number) => void;
        self: () => { x: number; y: number; mass: number } | null;
        seedFoodAt: (x: number, y: number, count?: number) => void;
      };
      const s = (window as unknown as { __agarSolo: Solo }).__agarSolo;

      // Park the player (no drift) so the seeded pellets stay in reach.
      s.setDir("none");
      const startMass = s.mass();

      let grewEveryStep = true;
      for (let i = 0; i < steps; i++) {
        const me = s.self();
        if (!me) {
          s.step(1);
          continue;
        }
        const before = s.mass();
        // Stack a batch of pellets exactly on the player.
        s.seedFoodAt(me.x, me.y, batch);
        s.step(1);
        const after = s.mass();
        // Net of +batch eats and the -1 decay this tick.
        if (after - before < batch - 1) grewEveryStep = false;
      }

      return { startMass, finalMass: s.mass(), grewEveryStep };
    },
    { batch: BATCH, steps: STEPS },
  );

  // The player GROWS by eating food: every step's eaten batch out-paced
  // decay, and the final mass is well above the start.
  expect(
    result.grewEveryStep,
    "each step's pellet batch grew mass by >=(BATCH-1) after decay",
  ).toBe(true);
  expect(
    result.finalMass,
    "mass increased above PLAYER_MASS_START via food",
  ).toBeGreaterThan(PLAYER_MASS_START);
  // STEPS batches of BATCH pellets each net at least (BATCH-1) per step.
  expect(
    result.finalMass - result.startMass,
    "cumulative growth matches net food intake minus decay",
  ).toBeGreaterThanOrEqual(STEPS * (BATCH - 1));
});

test("solo: the player EATS a smaller cell — mass jumps by more than a food pellet", async ({
  page,
}) => {
  await page.goto(SOLO_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!(window as unknown as { __agarSolo?: unknown }).__agarSolo,
    null,
    { timeout: 5000 },
  );

  // Hunt the nearest EDIBLE bot (mass < player / EAT_RATIO). Steer each
  // step toward it along the dominant axis. A food pellet adds +1; eating
  // a cell adds that cell's whole mass (>= 8 at spawn), so a single-step
  // mass jump of > 1 is an unambiguous cell-eat event. We record the
  // largest single-step jump observed.
  const result = await page.waitForFunction(
    () => {
      type Cell = { x: number; y: number; mass: number };
      type Solo = {
        mass: () => number;
        setDir: (d: string) => void;
        step: (n: number) => void;
        self: () => { x: number; y: number; mass: number } | null;
      };
      const w = window as unknown as {
        __agarSolo: Solo;
        __game: { canonical: { bots: Cell[] } };
        __agarMaxJump?: number;
      };
      const s = w.__agarSolo;
      if (w.__agarMaxJump === undefined) w.__agarMaxJump = 0;

      const EAT_RATIO = 1.1;
      // Run a batch of single steps, steering toward the nearest edible
      // bot and watching for a mass jump > 1.
      for (let i = 0; i < 60; i++) {
        const me = s.self();
        if (!me) {
          s.step(1);
          continue;
        }
        const bots = w.__game.canonical.bots;
        let best: Cell | null = null;
        let bestD2 = Infinity;
        for (const b of bots) {
          if (me.mass < b.mass * EAT_RATIO) continue; // not edible
          const dx = b.x - me.x;
          const dy = b.y - me.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = b;
          }
        }
        if (best) {
          const dx = best.x - me.x;
          const dy = best.y - me.y;
          s.setDir(
            Math.abs(dx) >= Math.abs(dy)
              ? dx >= 0
                ? "right"
                : "left"
              : dy >= 0
                ? "down"
                : "up",
          );
        } else {
          // No edible bot in sight — keep grazing food to grow first.
          s.setDir(i % 2 === 0 ? "right" : "down");
        }
        const before = s.mass();
        s.step(1);
        const jump = s.mass() - before;
        if (jump > w.__agarMaxJump) w.__agarMaxJump = jump;
      }
      return w.__agarMaxJump > 1;
    },
    null,
    { timeout: 30_000, polling: 50 },
  );

  expect(
    result,
    "observed a single-step mass jump > 1 (ate a smaller cell, not just food)",
  ).toBeTruthy();
});
