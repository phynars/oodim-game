// agar — slice 3/4 pure reducer.
//
// Single source of truth for "how a tick advances the world". The
// Durable Object integrates server-side; the e2e harness (and the
// upcoming agar-03 / #129 work) replays the same reducer offline to
// assert determinism. Because the function is pure (no Date.now, no
// Math.random, no I/O), the equality assertion is exact, not "close".
//
// Determinism contract:
//   - `step(state, input)` is pure: same (state, input) → same next
//     state. No reads of wall-clock, no global RNG.
//   - All randomness flows through `state.rng`, a 32-bit mulberry-style
//     PRNG seeded once at `initialState(seed)`. Reseeding mid-run is
//     not supported — the seed is a per-match constant.
//   - Input shape is the canonical intent the client sends. Unknown
//     directions become "none" (the reducer never throws on bad input
//     — the DO trusts it'd never see malformed intents in this slice,
//     but the reducer is the contract, not the wire format).
//
// What the world looks like in slice 3 (gameplay 3/4):
//   - ONE player (the single connected client). Slice 4 generalises to N.
//   - Position is a {x, y} pair in canvas pixels (640x640, matches the
//     `<canvas>` in agar/index.html). Walls at the edges clamp motion.
//   - Speed is 4 px / tick (= 80 px / s at 20Hz). Big enough for the
//     e2e to see motion in a handful of ticks, small enough that a
//     tape of ~30 inputs stays inside the canvas.
//   - A fixed pool of `FOOD_COUNT` pellets at deterministic positions.
//     On overlap with the player the pellet is consumed (mass + 1) and
//     a new pellet is spawned by advancing the seeded RNG. Because the
//     RNG state lives in `WorldState.rng` and is advanced through the
//     same `advance()` both server and offline reducer call, the food
//     field is bit-exact reproducible — required for the two-client
//     convergence gate (#180/#257) to hold.

export type InputDir = "none" | "up" | "down" | "left" | "right";

export interface InputIntent {
  dir: InputDir;
}

export interface PlayerState {
  x: number;
  y: number;
  // Player size, in "mass units". Starts at PLAYER_MASS_START; each
  // pellet adds 1. Derived radius = radiusForMass(mass).
  mass: number;
}

export interface Pellet {
  x: number;
  y: number;
}

// A bot cell — same shape as PlayerState plus a stable identity.
// Slice 4 ai-bots (#267): give solo play company by populating the
// field with greedy seekers. The bot is server-authoritative just
// like the player; it has no client-side logic of any kind. Position
// is in canvas pixels; mass starts at PLAYER_MASS_START and grows by
// 1 per pellet eaten, identical to the player. `id` lets the renderer
// stable-sort and keeps a future protocol able to address individual
// bots without index ambiguity.
export interface BotState {
  id: number;
  x: number;
  y: number;
  mass: number;
}

export interface WorldState {
  tick: number;
  player: PlayerState;
  // Fixed-size pool of food pellets. Length is FOOD_COUNT for the
  // lifetime of the match: when one is consumed, a replacement is
  // spawned at the same index from the next two RNG draws. The pool
  // is positional, but the protocol broadcasts the same array shape
  // every tick — both clients see identical food because both run
  // the same reducer from the same seed.
  food: Pellet[];
  // Fixed-size pool of AI bot cells. Length is BOT_COUNT for the
  // lifetime of the match. Each bot greedily steers toward its nearest
  // pellet; movement is bit-exact deterministic because nearest-pellet
  // selection is index-stable and motion is integer-clamped against
  // the world bounds. Bots eat pellets the same way the player does
  // (same overlap test, same respawn draw). Order matters: the loop
  // walks bots in index order so RNG consumption is reproducible.
  bots: BotState[];
  // 32-bit unsigned RNG state, advanced once per tick.
  rng: number;
}

// Canvas extent — must stay in sync with agar/index.html `<canvas>`.
export const WORLD_W = 640;
export const WORLD_H = 640;
export const SPEED = 4;
export const FOOD_COUNT = 40;
export const FOOD_R = 5;
export const PLAYER_MASS_START = 16;

// AI bot tuning. K=6 fills the 640x640 field enough that a solo player
// always has a neighbour cell on screen without the canvas turning into
// a swarm. Bots move at 3/4 player speed so a human can outrun them —
// the field feels populated, not contested. Math.floor keeps the per-
// tick step an integer so all motion stays bit-exact across machines.
export const BOT_COUNT = 6;
export const BOT_SPEED = Math.floor((SPEED * 3) / 4);

// Display radius for a given mass. sqrt() gives area-proportional growth
// (eating two pellets visibly increases the cell, but you don't fill
// the canvas after 10 bites). The constant tunes the starting size to
// match the slice-1/2 placeholder (mass=16 → r=16).
export function radiusForMass(mass: number): number {
  return Math.sqrt(Math.max(mass, 1)) * 4;
}

// Legacy export — some call sites referenced PLAYER_R in slice 1/2.
// Kept as the starting radius so anything still importing it gets the
// initial pose, not a stale constant.
export const PLAYER_R = radiusForMass(PLAYER_MASS_START);

// Mulberry32 — a tiny 32-bit PRNG. Pure: advance(s) → next s, no
// global state. The DO and the offline reducer both call advance() once
// per tick so the rng field stays in lockstep.
export function advance(s: number): number {
  // Keep arithmetic in 32-bit unsigned space.
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

// Convert a raw 32-bit rng state into a float in [0, 1). Used only to
// translate the rng into pellet coordinates; the rng itself is what
// the determinism gate compares.
function unitFromRng(s: number): number {
  return (s >>> 0) / 0x1_0000_0000;
}

// Spawn a single pellet by advancing the rng twice (one draw per axis).
// Returns the new rng state and the pellet position. Pure.
function spawnPellet(rng: number): { rng: number; pellet: Pellet } {
  const rx = advance(rng);
  const ry = advance(rx);
  const x = FOOD_R + unitFromRng(rx) * (WORLD_W - 2 * FOOD_R);
  const y = FOOD_R + unitFromRng(ry) * (WORLD_H - 2 * FOOD_R);
  return { rng: ry, pellet: { x, y } };
}

export function initialState(seed: number): WorldState {
  // Seed is normalised to a 32-bit unsigned int so callers can pass any
  // number (including the test harness's `parseInt` outputs) without
  // worrying about float coercion.
  let rng = (seed >>> 0) || 1;
  const food: Pellet[] = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    const out = spawnPellet(rng);
    rng = out.rng;
    food.push(out.pellet);
  }
  // Bots spawn AFTER food so the rng advancement order is stable: any
  // future change to BOT_COUNT shifts the post-spawn rng but never
  // perturbs the food field. Each bot consumes two rng draws (one per
  // axis), reusing spawnPellet because the position math is identical.
  const bots: BotState[] = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    const out = spawnPellet(rng);
    rng = out.rng;
    bots.push({
      id: i,
      x: out.pellet.x,
      y: out.pellet.y,
      mass: PLAYER_MASS_START,
    });
  }
  return {
    tick: 0,
    player: { x: WORLD_W / 2, y: WORLD_H / 2, mass: PLAYER_MASS_START },
    food,
    bots,
    rng,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function normalizeDir(dir: unknown): InputDir {
  switch (dir) {
    case "up":
    case "down":
    case "left":
    case "right":
      return dir;
    default:
      return "none";
  }
}

export function step(state: WorldState, input: InputIntent): WorldState {
  const dir = normalizeDir(input.dir);
  let dx = 0;
  let dy = 0;
  if (dir === "left") dx = -SPEED;
  else if (dir === "right") dx = SPEED;
  else if (dir === "up") dy = -SPEED;
  else if (dir === "down") dy = SPEED;

  const r = radiusForMass(state.player.mass);
  const nx = clamp(state.player.x + dx, r, WORLD_W - r);
  const ny = clamp(state.player.y + dy, r, WORLD_H - r);

  // Eat-and-grow pass. Walk the food pool once; any pellet whose center
  // sits inside (player radius + pellet radius) is consumed. Mass grows
  // by 1 per pellet; the consumed slot is refilled by advancing the rng
  // (two draws per replacement, just like initial spawn). Doing
  // collision after motion lets the player "scoop" a pellet by moving
  // onto it in one tick.
  let mass = state.player.mass;
  let rng = state.rng;
  const food = state.food.slice();
  for (let i = 0; i < food.length; i++) {
    const p = food[i];
    if (!p) continue;
    const ddx = p.x - nx;
    const ddy = p.y - ny;
    const reach = radiusForMass(mass) + FOOD_R;
    if (ddx * ddx + ddy * ddy <= reach * reach) {
      mass += 1;
      const out = spawnPellet(rng);
      rng = out.rng;
      food[i] = out.pellet;
    }
  }

  // Bot pass. For each bot, in stable index order:
  //   1. Pick the nearest pellet by squared distance (index-stable on
  //      ties: the lower-index pellet wins, because we only replace
  //      `best` on a strictly-smaller distance).
  //   2. Step BOT_SPEED pixels along whichever axis (x or y) has the
  //      larger absolute delta to that pellet — gives a Manhattan-ish
  //      seek that's cheap, integer-clean, and matches the player's
  //      "one axis at a time" feel.
  //   3. Eat any pellet now overlapping the bot. Same overlap test,
  //      same respawn draw as the player: rng threads through every
  //      consumption in index-order so the resulting state is
  //      bit-exact reproducible from (seed, input-tape).
  const bots: BotState[] = state.bots.map((b) => ({ ...b }));
  for (let bi = 0; bi < bots.length; bi++) {
    const bot = bots[bi];
    if (!bot) continue;

    // 1. Nearest-pellet selection.
    let bestIdx = -1;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let fi = 0; fi < food.length; fi++) {
      const p = food[fi];
      if (!p) continue;
      const ex = p.x - bot.x;
      const ey = p.y - bot.y;
      const d2 = ex * ex + ey * ey;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = fi;
      }
    }

    // 2. Seek step. If no pellet (shouldn't happen — pool is fixed-
    // size, refilled on eat) the bot holds position.
    let bx = bot.x;
    let by = bot.y;
    if (bestIdx !== -1) {
      const target = food[bestIdx];
      if (target) {
        const ex = target.x - bot.x;
        const ey = target.y - bot.y;
        const adx = Math.abs(ex);
        const ady = Math.abs(ey);
        if (adx >= ady) {
          bx += ex >= 0 ? BOT_SPEED : -BOT_SPEED;
        } else {
          by += ey >= 0 ? BOT_SPEED : -BOT_SPEED;
        }
        const br = radiusForMass(bot.mass);
        bx = clamp(bx, br, WORLD_W - br);
        by = clamp(by, br, WORLD_H - br);
      }
    }

    // 3. Eat-and-grow pass for this bot. Mirrors the player's loop.
    let bmass = bot.mass;
    for (let fi = 0; fi < food.length; fi++) {
      const p = food[fi];
      if (!p) continue;
      const ddx = p.x - bx;
      const ddy = p.y - by;
      const reach = radiusForMass(bmass) + FOOD_R;
      if (ddx * ddx + ddy * ddy <= reach * reach) {
        bmass += 1;
        const out = spawnPellet(rng);
        rng = out.rng;
        food[fi] = out.pellet;
      }
    }

    bots[bi] = { id: bot.id, x: bx, y: by, mass: bmass };
  }

  // Always advance rng once per tick (in addition to any food draws)
  // so the determinism gate's per-tick rng equality still holds in the
  // no-eat case. Slice 1/2 advanced rng once per tick unconditionally;
  // we preserve that property by advancing once more here.
  rng = advance(rng);

  return {
    tick: state.tick + 1,
    player: { x: nx, y: ny, mass },
    food,
    bots,
    rng,
  };
}

// Convenience for the offline reducer the e2e + #129 harness uses.
// Replays an ordered tape of inputs (one per tick) from a seed and
// returns the terminal state. Pure.
export function pureReplay(seed: number, tape: readonly InputIntent[]): WorldState {
  let s = initialState(seed);
  for (const i of tape) s = step(s, i);
  return s;
}
