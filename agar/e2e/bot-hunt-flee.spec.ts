import { expect, test } from "@playwright/test";
import {
  EAT_RATIO,
  PLAYER_MASS_START,
  WORLD_H,
  WORLD_W,
  step,
  type BotState,
  type InputIntent,
  type WorldState,
} from "../server/reducer";

// agar balance slice 2/4 (#298) — distance-trend assertion for the
// bot hunt/flee mechanic. Pursuit + flee are the entire point of this
// slice; the existing tick.spec.ts pure-replay equality only catches
// "the reducer disagrees with itself", which a silently-disabled
// hunt/flee branch (e.g. someone deletes the considerCell call) would
// pass. This spec hard-asserts the OBSERVABLE behaviour:
//
//   - When a bot is heavier than the player by > EAT_RATIO, the
//     player is "prey": the bot's distance to the player must
//     MONOTONICALLY (or near-monotonically) decrease over a window of
//     ticks where the player stands still.
//
//   - When a bot is lighter than the player by > EAT_RATIO, the
//     player is a "threat": the bot's distance to the player must
//     INCREASE over the same window.
//
// We build the WorldState by hand instead of going through
// initialState(seed) so the geometry is pinned and we don't have to
// hunt for a seed where a hunter happens to spawn near the player.
// step() doesn't care that the fixture didn't come from initialState
// — it's a pure function of the state shape.
//
// Why a Playwright spec, not vitest: the agar harness only runs
// Playwright (see agar/playwright.config.ts — no vitest config in
// this slice). Adding a node-only runner just for this file would be
// scope creep. The spec doesn't open a page; it imports the reducer
// directly and runs in the Playwright worker's node context. That's
// fine — Playwright happily runs node-only tests.

// Bot heavier than player by >EAT_RATIO. With player at mass 16,
// 20 satisfies 20 >= 16 * 1.10 = 17.6.
const HUNTER_MASS = 20;
// Bot lighter than player by >EAT_RATIO. With player at mass 16,
// 8 satisfies 16 >= 8 * 1.10 = 8.8 (so the bot sees the player as a
// threat from its own perspective).
const PREY_MASS = 8;

// Fixture geometry. Player at center; bot offset on +x by an amount
// that's well within the bot's sight radius (12 * r). At HUNTER_MASS=20,
// r = sqrt(20)*4 ≈ 17.9 → sight ≈ 215px. At PREY_MASS=8, r ≈ 11.3 →
// sight ≈ 136px. 100px is comfortably inside both, so the bot sees
// the player on tick 1 and starts steering immediately.
const BOT_OFFSET_X = 100;
const PLAYER_X = WORLD_W / 2; // 320
const PLAYER_Y = WORLD_H / 2; // 320

// How many ticks we step. Bot moves BOT_SPEED=3 px/tick along the
// chosen axis; closing 100px takes ~34 ticks if the player stays
// still. We measure over 10 ticks so the bot moves ~30px (enough to
// see a clean monotonic trend) and we're nowhere near the
// cell-eats-cell collision radius (bot at HUNTER_MASS=20 has r≈18,
// collision triggers at distance ≈ 18 — we stay above 70).
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
    // #299 — death counter + best-mass start at the natural defaults
    // a fresh initialState() would produce. This spec doesn't exercise
    // death; the fields are required by the WorldState shape and the
    // step() pass-through preserves them.
    deaths: 0,
    bestMass: PLAYER_MASS_START,
    // Empty food pool — no pellet draws, no growth noise, no rng
    // movement. The step() loop iterates food.length so length-0 is
    // a clean no-op.
    food: [],
    bots: [bot],
    // Any non-zero rng is fine; this spec doesn't depend on
    // randomness — the bot's seek decision is purely geometric.
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

test("agar #298 — heavier bot pursues player (distance decreases)", () => {
  // Sanity: the fixture's mass ratio actually triggers prey-mode in
  // the bot's eyes. If EAT_RATIO ever moves above 20/16=1.25, this
  // spec must be re-tuned — the assert below would catch it.
  expect(HUNTER_MASS).toBeGreaterThanOrEqual(PLAYER_MASS_START * EAT_RATIO);

  let s = makeFixture(HUNTER_MASS);
  const initial = botDist2(s);

  // Walk the window. We assert the FINAL distance is strictly less
  // than the initial — pursuit is real motion toward the player, not
  // jitter. We also assert the trend is monotonic-non-increasing
  // across the window (one regression mid-window would also be a
  // signal worth catching).
  let prev = initial;
  for (let t = 0; t < WINDOW; t++) {
    s = step(s, HOLD);
    const d2 = botDist2(s);
    // Greedy one-axis seek: distance never INCREASES on a tick where
    // the bot is hunting (it always steps toward the player on the
    // dominant axis). `<=` not `<` because the bot could be clamped
    // against the world bound — not the case in this fixture but
    // belt-and-suspenders.
    expect(d2).toBeLessThanOrEqual(prev);
    prev = d2;
  }

  expect(botDist2(s)).toBeLessThan(initial);
});

test("agar #298 — lighter bot flees player (distance increases)", () => {
  // Sanity: the fixture's mass ratio actually triggers threat-mode in
  // the bot's eyes.
  expect(PLAYER_MASS_START).toBeGreaterThanOrEqual(PREY_MASS * EAT_RATIO);

  let s = makeFixture(PREY_MASS);
  const initial = botDist2(s);

  let prev = initial;
  for (let t = 0; t < WINDOW; t++) {
    s = step(s, HOLD);
    const d2 = botDist2(s);
    // Flee is the mirror image: distance never DECREASES on a tick
    // where the bot is fleeing. Same clamp caveat as pursuit (the
    // bot could be pushed against a wall by the flee step) — we use
    // `>=` so a wall-bound flee tick (no further retreat possible)
    // still passes. The strict initial-vs-final check below catches
    // the "bot never moved away at all" regression.
    expect(d2).toBeGreaterThanOrEqual(prev);
    prev = d2;
  }

  expect(botDist2(s)).toBeGreaterThan(initial);
});
