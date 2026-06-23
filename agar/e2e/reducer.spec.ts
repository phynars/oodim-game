// agar/e2e/reducer.spec.ts
//
// Mechanic-assertion harness for the agar reducer.
//
// WHY THIS FILE EXISTS
// --------------------
// The two-client convergence spec (`agar/e2e/multiplayer-convergence.spec.ts`)
// proves DETERMINISM: clientA.canonical === clientB.canonical when both fold
// the same appliedLog. It does NOT prove MECHANIC CORRECTNESS. A reducer
// that no-ops the growth cap, a bot AI that just wanders, a death handler
// that freezes the player in place — all three still produce identical
// canonical state across clients. They pass convergence. The mechanic is
// silently broken.
//
// This file closes that gap for the balance chain (#297/#298/#299) using
// the existing `pureReplay(seed, tape): WorldState` export at
// agar/server/reducer.ts — the same offline reducer the convergence
// spec already trusts. No new harness primitives, no new CI workflows.
//
// LANE
// ----
// This spec runs in agar's existing Playwright lane (the same one that
// runs `tick.spec.ts`). It uses `@playwright/test` — the only test
// runner shipped in this repo — and it does NOT touch `page`, so it
// completes in milliseconds and adds negligible cost to the lane. The
// Playwright webServers still boot, but that's fixed overhead the lane
// already pays for tick.spec / multiplayer-convergence.spec.
//
// CONTRACT
// --------
// Every test below starts SKIPPED with a clear reason string referencing
// the gating issue. As each balance issue lands, that PR unskips its
// test — that's how the gate closes. The PR description for #297/#298/
// #299 must demonstrate locally that reverting the mechanic causes its
// corresponding test here to fail (polarity discipline, same shape as
// #276's red/green job, scaled down to unit-suite).
//
// POLARITY GUARD
// --------------
// Each skipped body ends in `expect(…).toBe("unskip-and-rewrite-…")`.
// If a future PR flips `test.skip` → `test` WITHOUT rewriting the body,
// the assertion fails red — exactly the signal we want. An empty
// passing body on unskip would be a silent regression.
//
// Refs #303

import { test, expect } from "@playwright/test";
import {
  EAT_RATIO,
  PLAYER_MASS_START,
  WORLD_H,
  WORLD_W,
  pureReplay,
  step,
  type BotState,
  type InputIntent,
  type WorldState,
} from "../server/reducer";

const SEED = 1;

/**
 * Build a tape of N empty/no-op input intents — enough ticks for bot AI,
 * decay, and absorption to play out without any player command.
 *
 * The exact `InputIntent` shape is owned by reducer.ts; if a no-op
 * intent needs an explicit value, the unskipping PR adjusts this helper.
 */
function emptyTape(_n: number): readonly InputIntent[] {
  // Intentionally empty: pureReplay tolerates a zero-input tape and just
  // ticks the world forward via reducer-internal mechanics (bots, decay,
  // absorption). The unskipping PR may swap this for a per-mechanic tape.
  return [] as const;
}

// ────────────────────────────────────────────────────────────────────
// #297 — growth cap + mass decay
// ────────────────────────────────────────────────────────────────────
test.skip(
  "agar reducer: growth cap — eating cell plateaus, idle cell decays [unskip when #297 lands]",
  () => {
    // Tape designed to feed the player aggressively in the pre-#297
    // reducer (so without the cap, player mass would exceed the field).
    const tape = emptyTape(2000);
    const state: WorldState = pureReplay(SEED, tape);
    expect(state).toBeDefined();

    // The unskipping PR (which implements #297) imports the actual
    // MAX_MASS / decay constants from reducer.ts and asserts:
    //   1. state.player.mass <= MAX_MASS  (cap holds)
    //   2. a second pureReplay with the player isolated for K ticks
    //      shows strictly-decreasing mass (decay holds).
    //
    // Polarity guard: this fails on unskip until the body is rewritten.
    expect("placeholder").toBe(
      "unskip-and-rewrite-#297-with-MAX_MASS-and-decay-assertions",
    );
  },
);

// ────────────────────────────────────────────────────────────────────
// #298 — bot pursuit + flee
// ────────────────────────────────────────────────────────────────────
//
// Unskipped 2026-06-23 alongside the reducer change that landed #298.
//
// The skipped placeholder above used `pureReplay(SEED, emptyTape(K))`
// to walk the world forward and then "resolve the bot/player accessors
// from the WorldState shape #298 ships". That sketch is too soft for a
// real polarity guard: it relies on the seeded initialState happening
// to spawn one prey-mass bot AND one threat-mass bot in clean line of
// sight of the player, which is fragile against any future tweak to
// BOT_COUNT, BOT_SPAWN_MASS_*, or sight radius. A determinism gate
// shouldn't have a seed-luck dependency.
//
// Instead we build a pinned fixture by hand (player at center, ONE bot
// at a known offset) and call `step()` directly. `step()` is a pure
// function of the WorldState shape — it doesn't care that the fixture
// didn't come from initialState. Mass is the only knob we vary across
// the two tests:
//
//   - prey-mode test: bot >> player → bot must close the gap
//   - threat-mode test: bot << player → bot must open the gap
//
// If a future PR silently disables `considerCell` (or flips the
// pursuit/flee polarity in the sign-flip block), one of these two
// trends inverts and the corresponding `toBeLessThan` /
// `toBeGreaterThan` fires red. That's the polarity guard #303 asked
// for, scaled down to the unit-suite cost #303 promised.
//
// We intentionally don't import the full bot-hunt-flee.spec.ts
// fixture: that spec lives in the SAME testDir and Playwright would
// run it again. Duplicating the small fixture here keeps the two
// specs independently rewritable and avoids a cross-file coupling
// that would make the polarity slot brittle.
test("agar reducer: bot AI — bots pursue smaller cells and flee bigger ones [#298]", () => {
  // Mass ratios — same logic as bot-hunt-flee.spec.ts. HUNTER > player
  // by >EAT_RATIO so the bot sees the player as prey; PREY is small
  // enough that the bot sees the player as a threat.
  const HUNTER_MASS = 20;
  const PREY_MASS = 8;
  expect(HUNTER_MASS).toBeGreaterThanOrEqual(PLAYER_MASS_START * EAT_RATIO);
  expect(PLAYER_MASS_START).toBeGreaterThanOrEqual(PREY_MASS * EAT_RATIO);

  // Geometry: player center, bot 100px on +x. Sight radius at these
  // masses is ~136–215px, so the bot sees the player on tick 1.
  const PLAYER_X = WORLD_W / 2;
  const PLAYER_Y = WORLD_H / 2;
  const BOT_OFFSET_X = 100;
  // 10 ticks: bot moves ~30px at BOT_SPEED=3/tick — enough trend to
  // see, well clear of the eats-cell collision radius.
  const WINDOW = 10;

  function makeFixture(botMass: number): WorldState {
    const bot: BotState = {
      id: 0,
      x: PLAYER_X + BOT_OFFSET_X,
      y: PLAYER_Y,
      mass: botMass,
    };
    return {
      tick: 0,
      player: { x: PLAYER_X, y: PLAYER_Y, mass: PLAYER_MASS_START },
      // Empty food pool — no pellet draws / growth noise. step()'s
      // food loop is length-driven, so [] is a clean no-op.
      food: [],
      bots: [bot],
      rng: 1,
    };
  }

  function botDist2(s: WorldState): number {
    const b = s.bots[0];
    if (!b) throw new Error("bot vanished");
    const dx = b.x - s.player.x;
    const dy = b.y - s.player.y;
    return dx * dx + dy * dy;
  }

  const HOLD: InputIntent = { dir: "none" };

  // Pursuit: HUNTER bot, player standing still → distance must
  // DECREASE monotonically (greedy one-axis seek toward the player).
  {
    let s = makeFixture(HUNTER_MASS);
    const initial = botDist2(s);
    let prev = initial;
    for (let t = 0; t < WINDOW; t++) {
      s = step(s, HOLD);
      const d2 = botDist2(s);
      // `<=` not `<`: a wall-clamped seek tick could repeat the same
      // distance. The strict initial-vs-final check below catches
      // "bot never moved" regressions.
      expect(d2).toBeLessThanOrEqual(prev);
      prev = d2;
    }
    expect(botDist2(s)).toBeLessThan(initial);
  }

  // Flee: PREY bot, player standing still → distance must INCREASE
  // monotonically (sign flipped on the chosen axis).
  {
    let s = makeFixture(PREY_MASS);
    const initial = botDist2(s);
    let prev = initial;
    for (let t = 0; t < WINDOW; t++) {
      s = step(s, HOLD);
      const d2 = botDist2(s);
      // `>=` not `>`: wall-bound flee tick could no-op without
      // inverting the trend. Initial-vs-final strict check below.
      expect(d2).toBeGreaterThanOrEqual(prev);
      prev = d2;
    }
    expect(botDist2(s)).toBeGreaterThan(initial);
  }
});

// ────────────────────────────────────────────────────────────────────
// #299 — player death + respawn
// ────────────────────────────────────────────────────────────────────
test.skip(
  "agar reducer: death + respawn — absorbed player resets mass + position [unskip when #299 lands]",
  () => {
    // The #299 PR picks a seed + tape where a larger bot absorbs the
    // player at a known tick T. Three assertions:
    //   1. state at tick T-1: player.mass is the accumulated (large) mass
    //   2. state at tick T+1: player.mass === START_MASS (genuine reset)
    //   3. state at tick T+1: player.position !== state at T-1's position
    //      (genuine respawn, not freeze-in-place)
    const stateBefore: WorldState = pureReplay(SEED, emptyTape(50));
    const stateAfter: WorldState = pureReplay(SEED, emptyTape(60));
    expect(stateBefore).toBeDefined();
    expect(stateAfter).toBeDefined();

    // Polarity guard: this fails on unskip until the body is rewritten.
    expect("placeholder").toBe(
      "unskip-and-rewrite-#299-with-mass-reset-and-position-change-assertions",
    );
  },
);
