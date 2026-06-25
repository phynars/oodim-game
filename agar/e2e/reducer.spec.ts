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
  MAX_MASS,
  PLAYER_MASS_START,
  WORLD_H,
  WORLD_W,
  step,
  type BotState,
  type PlayerState,
  type ReplayFrame,
  type WorldState,
} from "../server/reducer";

const PLAYER_ID = "p0";

// Hold-still input frame for a single hand-built player. Slice 4
// inputs are keyed by id; emit a per-tick `{p0: {dir:"none"}}` so the
// reducer's id-keyed routing matches the fixture.
const HOLD_FRAME: ReplayFrame = { inputs: { [PLAYER_ID]: { dir: "none" } } };

function self(s: WorldState): PlayerState {
  const p = s.players.find((q) => q.id === PLAYER_ID);
  if (!p) throw new Error("self vanished from roster");
  return p;
}

// ────────────────────────────────────────────────────────────────────
// #297 — growth cap + mass decay
// ────────────────────────────────────────────────────────────────────
//
// Same fixture-driven approach as the #298/#299 tests below: hand-build a
// WorldState and step() the reducer directly rather than driving pureReplay
// from initialState. "Feed the player past the field" via a tape would depend
// on seed-luck steering the player into randomly-spawned food; a pinned
// fixture is a sharper polarity guard for the two mechanics this gates —
// the growth CAP and the mass DECAY.
test("agar reducer: growth cap + mass decay [#297]", () => {
  const PX = WORLD_W / 2;
  const PY = WORLD_H / 2;

  // CAP — a player already at MAX_MASS, sitting in a dense food field, never
  // exceeds MAX_MASS however much it eats. Polarity: if addMass stops
  // saturating, mass climbs past the cap and this `<=` fires.
  {
    const player: PlayerState = {
      id: PLAYER_ID,
      x: PX,
      y: PY,
      mass: MAX_MASS,
      deaths: 0,
      bestMass: MAX_MASS,
    };
    const food = Array.from({ length: 32 }, () => ({ x: PX, y: PY }));
    let s: WorldState = { tick: 0, players: [player], food, bots: [], rng: 1 };
    for (let t = 0; t < 10; t++) {
      s = step(s, HOLD_FRAME);
      expect(self(s).mass).toBeLessThanOrEqual(MAX_MASS);
    }
  }

  // DECAY — an above-start player that eats nothing strictly loses mass every
  // tick, flooring at PLAYER_MASS_START. Pre-#297 the decay was INERT:
  // `floor(m * DECAY_NUMER / DECAY_DENOM)` === 0 for every reachable mass
  // (m < 2048, and mass is capped at 1024), so an idle cell never shrank.
  // Polarity: revert applyDecay's floor-at-1 and this strictly-decreasing
  // assertion fires on tick 1.
  {
    const START = 100;
    const player: PlayerState = {
      id: PLAYER_ID,
      x: PX,
      y: PY,
      mass: START,
      deaths: 0,
      bestMass: START,
    };
    let s: WorldState = { tick: 0, players: [player], food: [], bots: [], rng: 1 };
    let prev = self(s).mass;
    for (let t = 0; t < 10; t++) {
      s = step(s, HOLD_FRAME);
      const m = self(s).mass;
      expect(m).toBeLessThan(prev);
      expect(m).toBeGreaterThanOrEqual(PLAYER_MASS_START);
      prev = m;
    }
    expect(self(s).mass).toBeLessThan(START);
  }
});

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
// the two trends:
//
//   - prey-mode: bot >> player → bot must close the gap
//   - threat-mode: bot << player → bot must open the gap
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
    const player: PlayerState = {
      id: PLAYER_ID,
      x: PLAYER_X,
      y: PLAYER_Y,
      mass: PLAYER_MASS_START,
      deaths: 0,
      bestMass: PLAYER_MASS_START,
    };
    return {
      tick: 0,
      players: [player],
      food: [],
      bots: [bot],
      rng: 1,
    };
  }

  function botDist2(s: WorldState): number {
    const b = s.bots[0];
    if (!b) throw new Error("bot vanished");
    const p = self(s);
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    return dx * dx + dy * dy;
  }

  // Pursuit: HUNTER bot, player standing still → distance must
  // DECREASE monotonically.
  {
    let s = makeFixture(HUNTER_MASS);
    const initial = botDist2(s);
    let prev = initial;
    for (let t = 0; t < WINDOW; t++) {
      s = step(s, HOLD_FRAME);
      const d2 = botDist2(s);
      expect(d2).toBeLessThanOrEqual(prev);
      prev = d2;
    }
    expect(botDist2(s)).toBeLessThan(initial);
  }

  // Flee: PREY bot, player standing still → distance must INCREASE
  // monotonically.
  {
    let s = makeFixture(PREY_MASS);
    const initial = botDist2(s);
    let prev = initial;
    for (let t = 0; t < WINDOW; t++) {
      s = step(s, HOLD_FRAME);
      const d2 = botDist2(s);
      expect(d2).toBeGreaterThanOrEqual(prev);
      prev = d2;
    }
    expect(botDist2(s)).toBeGreaterThan(initial);
  }
});

// ────────────────────────────────────────────────────────────────────
// #299 — player death + respawn
// ────────────────────────────────────────────────────────────────────
//
// Same fixture-driven approach as the #298 test: pin a bigger bot on
// top of the player and step() the reducer directly. Removes the
// seed-luck dependency (we don't have to hope initialState happens to
// spawn an overlapping threat). On tick 1 the cell-eats-cell pass
// fires and the player is absorbed — the test asserts the FOUR
// observable consequences of #299:
//
//   1. mass resets to PLAYER_MASS_START (genuine reset, not freeze).
//   2. position changes (NOT center, NOT the previous position —
//      respawn uses a fresh deterministic spawnPellet draw).
//   3. state.deaths increments (the scoreboard tick that drives the
//      client's "eaten" banner).
//   4. state.bestMass preserves the pre-death record (so the
//      high-water mark survives the death — that's what makes the
//      score-line cost real).
//
// Polarity: if a future PR collapses respawn back to center, the
// position assertion against (WORLD_W/2, WORLD_H/2) fires. If the
// death increment is removed, the deaths assertion fires. If mass
// reset is silently disabled, the start-mass equality fires. Three
// failure modes, one test, no seed brittleness.
test("agar reducer: death + respawn — absorbed player resets mass + position, deaths increments [#299]", () => {
  const PLAYER_X = WORLD_W / 2;
  const PLAYER_Y = WORLD_H / 2;
  // Big-enough mass that bot.mass >= player.mass * EAT_RATIO holds
  // sharply. Player carries an above-START mass so we can also assert
  // the reset is genuine (not just "mass was already START").
  const PLAYER_PRE_MASS = 30;
  const KILLER_MASS = 80;
  expect(KILLER_MASS).toBeGreaterThanOrEqual(PLAYER_PRE_MASS * EAT_RATIO);

  const fixture: WorldState = {
    tick: 0,
    players: [
      {
        id: PLAYER_ID,
        x: PLAYER_X,
        y: PLAYER_Y,
        mass: PLAYER_PRE_MASS,
        deaths: 0,
        bestMass: PLAYER_PRE_MASS,
      },
    ],
    food: [],
    bots: [{ id: 0, x: PLAYER_X, y: PLAYER_Y, mass: KILLER_MASS }],
    rng: 1,
  };

  const after = step(fixture, HOLD_FRAME);
  const survivor = self(after);

  // 1. mass reset.
  expect(survivor.mass).toBe(PLAYER_MASS_START);

  // 2. position changed AND not stuck-at-center.
  const samePos = survivor.x === PLAYER_X && survivor.y === PLAYER_Y;
  expect(samePos).toBe(false);

  // 3. per-player death counter ticked up.
  expect(survivor.deaths).toBe(1);

  // 4. per-player best-mass survives the death.
  expect(survivor.bestMass).toBeGreaterThanOrEqual(PLAYER_PRE_MASS);
});
