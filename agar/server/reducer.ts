// agar — slice 4/4 pure reducer (true multiplayer).
//
// Single source of truth for "how a tick advances the world". The
// Durable Object integrates server-side; the e2e harness replays the
// same reducer offline to assert determinism. Because the function is
// pure (no Date.now, no Math.random, no I/O), the equality assertion
// is exact, not "close".
//
// Determinism contract:
//   - `step(state, inputs)` is pure: same (state, inputs) → same next
//     state. No reads of wall-clock, no global RNG.
//   - All randomness flows through `state.rng`, a 32-bit mulberry-style
//     PRNG seeded once at `initialState(seed)`. The seed is a per-match
//     constant.
//   - Inputs are a record keyed by player id. A player with no entry
//     this tick (no input pending) is advanced with `{dir:"none"}`. An
//     entry for an id NOT in `state.players` is ignored (a stale ghost
//     from a player who already left).
//
// What the world looks like in slice 4 (gameplay 4/4 — true multiplayer):
//   - N players, keyed by string id (the client mints its own id on
//     page load and the server uses it as the player key). Each WS
//     spawns + controls its own cell; everyone sees everyone; cells
//     can eat each other (player↔player, same EAT_RATIO rule as the
//     existing player↔bot path).
//   - Players are stored in a positional array sorted by id ascending,
//     so iteration order is stable across clients walking the same
//     input tape (set/object iteration order is engine-defined for
//     string keys but a sorted array is bit-exact regardless of the
//     order joins happened). `joinPlayer` / `leavePlayer` are pure
//     helpers the DO calls on connect / close.
//   - Position is a {x, y} pair in canvas pixels (640x640). Walls at
//     the edges clamp motion. Speed is 4 px / tick.
//   - A fixed pool of `FOOD_COUNT` pellets at deterministic positions.
//
// Compatibility note — pureReplay tape shape changed:
//   - Pre-slice-4: tape = InputIntent[] (one intent per tick, single
//     player).
//   - Slice 4: tape = ReplayFrame[] where ReplayFrame = {
//       joins?: PlayerJoin[];      // ids that joined THIS tick
//       leaves?: string[];         // ids that left THIS tick
//       inputs?: Record<string,InputIntent>;  // per-id intent
//     }
//   - The DO broadcasts the join/leave/inputs record in every snapshot
//     so clients can rebuild the canonical tape and `pureReplay` reproduces
//     state exactly. A single-player replay collapses to one entry per
//     tick under `inputs[onlyId]`, identical to the old contract.

export type InputDir = "none" | "up" | "down" | "left" | "right";

export interface InputIntent {
  dir: InputDir;
}

export interface PlayerState {
  // Stable string id — the client mints it; the server uses it as the
  // map key. Embedded in the value so iteration produces self-contained
  // entries the renderer can address.
  id: string;
  x: number;
  y: number;
  // Player size, in "mass units". Starts at PLAYER_MASS_START; each
  // pellet adds 1. Derived radius = radiusForMass(mass).
  mass: number;
  // Per-player death counter (#299 → carried per-player in slice 4).
  // Monotonic count of how many times THIS player has been absorbed
  // by a bigger cell this match. Incremented in the cell-eats-cell
  // pass at the moment of respawn; never decremented.
  deaths: number;
  // Per-player best mass (#299 → per-player). Highest mass THIS player
  // has held this match. Floor of PLAYER_MASS_START so it's well-
  // defined from join.
  bestMass: number;
}

export interface Pellet {
  x: number;
  y: number;
}

// A bot cell — same shape as PlayerState plus a stable identity.
export interface BotState {
  id: number;
  x: number;
  y: number;
  mass: number;
}

// Per-tick replay frame — the canonical record the DO broadcasts and
// the harness feeds back into `pureReplay`. Every field is optional;
// an empty frame ticks the world with no joins, no leaves, no inputs
// (all extant players step with dir="none").
export interface ReplayFrame {
  joins?: PlayerJoin[];
  leaves?: string[];
  inputs?: Record<string, InputIntent>;
}

// Join descriptor — the id is required; the spawn position is rolled
// from the world rng at apply time inside `applyJoins`, NOT carried on
// the wire (carrying it would let a client lie about its spawn). The
// DO calls `joinPlayer` synchronously when a socket connects, but the
// reducer's batched `step` accepts the joins via the frame so an
// offline replay reconstructs spawn positions from the same rng draws.
export interface PlayerJoin {
  id: string;
}

export interface WorldState {
  tick: number;
  // Player roster, sorted by id ascending. Bit-exact stable across
  // clients regardless of join order. Lookup is O(N) but N is small
  // (lobby-scale multiplayer) and the eat passes already walk all
  // players, so adding an id-index would just duplicate the array.
  players: PlayerState[];
  // Fixed-size pool of food pellets. Length is FOOD_COUNT for the
  // lifetime of the match.
  food: Pellet[];
  // Fixed-size pool of AI bot cells. Length is BOT_COUNT.
  bots: BotState[];
  // 32-bit unsigned RNG state, advanced once per tick + on every
  // pellet/respawn/spawn draw.
  rng: number;
}

// Canvas extent — must stay in sync with agar/index.html `<canvas>`.
export const WORLD_W = 640;
export const WORLD_H = 640;
export const SPEED = 4;
export const FOOD_COUNT = 40;
export const FOOD_R = 5;
export const PLAYER_MASS_START = 16;

export const BOT_COUNT = 6;
export const BOT_SPEED = Math.floor((SPEED * 3) / 4);

export const BOT_SPAWN_MASS_MIN = PLAYER_MASS_START >> 1; // 8
export const BOT_SPAWN_MASS_MAX = PLAYER_MASS_START * 3; // 48

export const BOT_SIGHT_MULT = 12;

// Mass balance (#297, balance slice 1/4) — see slice-1 commit for
// tuning rationale. MAX_MASS=1024, DECAY 1/2048 per tick at 20Hz.
export const MAX_MASS = 1024;
export const DECAY_NUMER = 1;
export const DECAY_DENOM = 2048;

function applyDecay(m: number): number {
  if (m <= PLAYER_MASS_START) return m;
  // Proportional decay — bigger cells shrink faster (agar canon). The raw
  // term `floor(m * NUMER / DENOM)` rounds to 0 for every *reachable* mass
  // (m < DECAY_DENOM = 2048, but MAX_MASS caps mass at 1024), which made the
  // mechanic INERT — an idle cell never shrank (#297/#303). Floor the loss at
  // 1 for any above-start cell so decay always fires; it never drops a cell
  // below PLAYER_MASS_START.
  const proportional = ((m * DECAY_NUMER) / DECAY_DENOM) | 0;
  const loss = proportional < 1 ? 1 : proportional;
  const next = m - loss;
  return next < PLAYER_MASS_START ? PLAYER_MASS_START : next;
}

function addMass(m: number, delta: number): number {
  const next = m + delta;
  return next > MAX_MASS ? MAX_MASS : next;
}

export const EAT_RATIO = 1.1;

export function radiusForMass(mass: number): number {
  return Math.sqrt(Math.max(mass, 1)) * 4;
}

export const PLAYER_R = radiusForMass(PLAYER_MASS_START);

// Mulberry32 — a tiny 32-bit PRNG. Pure: advance(s) → next s.
export function advance(s: number): number {
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

function unitFromRng(s: number): number {
  return (s >>> 0) / 0x1_0000_0000;
}

function spawnPellet(rng: number): { rng: number; pellet: Pellet } {
  const rx = advance(rng);
  const ry = advance(rx);
  const x = FOOD_R + unitFromRng(rx) * (WORLD_W - 2 * FOOD_R);
  const y = FOOD_R + unitFromRng(ry) * (WORLD_H - 2 * FOOD_R);
  return { rng: ry, pellet: { x, y } };
}

export function initialState(seed: number): WorldState {
  let rng = (seed >>> 0) || 1;
  const food: Pellet[] = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    const out = spawnPellet(rng);
    rng = out.rng;
    food.push(out.pellet);
  }
  const bots: BotState[] = [];
  const spawnRange = BOT_SPAWN_MASS_MAX - BOT_SPAWN_MASS_MIN + 1;
  for (let i = 0; i < BOT_COUNT; i++) {
    const out = spawnPellet(rng);
    rng = out.rng;
    const rngMass = advance(rng);
    rng = rngMass;
    const spawnMass =
      BOT_SPAWN_MASS_MIN + ((unitFromRng(rngMass) * spawnRange) | 0);
    bots.push({
      id: i,
      x: out.pellet.x,
      y: out.pellet.y,
      mass: spawnMass,
    });
  }
  return {
    tick: 0,
    // No players at tick 0 — the DO calls applyJoins when sockets
    // connect, threading the world rng to assign spawn positions.
    // (This differs from slice-3, which always had exactly one player
    // baked in at world center. Slice 4 makes the empty room the
    // honest pre-connect state.)
    players: [],
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

// Insert players in id-ascending order. Returns a new array; pure.
// Spawn position rolls TWO rng draws (spawnPellet) per join; mass is
// PLAYER_MASS_START. Joins for an id already present are no-ops (a
// reconnect under the same clientId resumes the existing cell — the
// renderer/test surface needs this so disconnectWs/reconnectWs in the
// convergence harness doesn't accidentally double-roster a client).
function applyJoins(
  players: readonly PlayerState[],
  joins: readonly PlayerJoin[],
  rng: number,
): { players: PlayerState[]; rng: number } {
  let next = players.slice();
  let r = rng;
  for (const j of joins) {
    if (next.some((p) => p.id === j.id)) continue;
    const out = spawnPellet(r);
    r = out.rng;
    const fresh: PlayerState = {
      id: j.id,
      x: out.pellet.x,
      y: out.pellet.y,
      mass: PLAYER_MASS_START,
      deaths: 0,
      bestMass: PLAYER_MASS_START,
    };
    // Insertion sort by id ascending — keeps the array sorted so all
    // clients walk the roster in the same order without re-sorting
    // every tick.
    let inserted = false;
    const result: PlayerState[] = [];
    for (const p of next) {
      if (!inserted && fresh.id < p.id) {
        result.push(fresh);
        inserted = true;
      }
      result.push(p);
    }
    if (!inserted) result.push(fresh);
    next = result;
  }
  return { players: next, rng: r };
}

function applyLeaves(
  players: readonly PlayerState[],
  leaves: readonly string[],
): PlayerState[] {
  if (leaves.length === 0) return players.slice();
  const dead = new Set(leaves);
  return players.filter((p) => !dead.has(p.id));
}

export function step(state: WorldState, frame: ReplayFrame): WorldState {
  // 0. Joins first (their spawn positions roll rng), then leaves.
  //    Joining mid-tick means a fresh cell is exposed to the tick's
  //    eat passes; leaving mid-tick removes a cell before its inputs
  //    are evaluated. Order is: joins → leaves → motion+eats. Same
  //    order on every client because the frame carries them; both
  //    sides apply identical sequences.
  let players: PlayerState[];
  let rng = state.rng;
  if (frame.joins && frame.joins.length > 0) {
    const j = applyJoins(state.players, frame.joins, rng);
    players = j.players;
    rng = j.rng;
  } else {
    players = state.players.slice();
  }
  if (frame.leaves && frame.leaves.length > 0) {
    players = applyLeaves(players, frame.leaves);
  }

  const inputs = frame.inputs ?? {};

  // 1. Player motion + pellet eat pass. Walk players in id order
  //    (the array is sorted); each one steps with its own dir from
  //    `inputs` (default "none"), then eats any overlapping pellets.
  //    RNG threads through every pellet respawn in player-order.
  const food = state.food.slice();
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    if (!p) continue;
    const dir = normalizeDir(inputs[p.id]?.dir);
    let dx = 0;
    let dy = 0;
    if (dir === "left") dx = -SPEED;
    else if (dir === "right") dx = SPEED;
    else if (dir === "up") dy = -SPEED;
    else if (dir === "down") dy = SPEED;

    const r = radiusForMass(p.mass);
    const nx = clamp(p.x + dx, r, WORLD_W - r);
    const ny = clamp(p.y + dy, r, WORLD_H - r);

    let mass = p.mass;
    for (let i = 0; i < food.length; i++) {
      const pellet = food[i];
      if (!pellet) continue;
      const ddx = pellet.x - nx;
      const ddy = pellet.y - ny;
      const reach = radiusForMass(mass) + FOOD_R;
      if (ddx * ddx + ddy * ddy <= reach * reach) {
        mass = addMass(mass, 1);
        const out = spawnPellet(rng);
        rng = out.rng;
        food[i] = out.pellet;
      }
    }

    players[pi] = {
      id: p.id,
      x: nx,
      y: ny,
      mass,
      deaths: p.deaths,
      bestMass: p.bestMass,
    };
  }

  // 2. Bot motion + pellet eat. Bots scan all players + other bots for
  //    prey/threat (the considerCell helper sweeps the roster, so a
  //    second player in the room is just another cell to the bots —
  //    no special-case code).
  const bots: BotState[] = state.bots.map((b) => ({ ...b }));
  for (let bi = 0; bi < bots.length; bi++) {
    const bot = bots[bi];
    if (!bot) continue;

    const botR = radiusForMass(bot.mass);
    const sight = botR * BOT_SIGHT_MULT;
    const sight2 = sight * sight;

    let preyDx = 0;
    let preyDy = 0;
    let preyD2 = Number.POSITIVE_INFINITY;
    let threatDx = 0;
    let threatDy = 0;
    let threatD2 = Number.POSITIVE_INFINITY;

    const considerCell = (ox: number, oy: number, omass: number) => {
      const ex = ox - bot.x;
      const ey = oy - bot.y;
      const d2 = ex * ex + ey * ey;
      if (d2 > sight2) return;
      if (bot.mass >= omass * EAT_RATIO) {
        if (d2 < preyD2) {
          preyD2 = d2;
          preyDx = ex;
          preyDy = ey;
        }
      } else if (omass >= bot.mass * EAT_RATIO) {
        if (d2 < threatD2) {
          threatD2 = d2;
          threatDx = ex;
          threatDy = ey;
        }
      }
    };

    // Players first (id-sorted), then other bots in index order.
    for (const p of players) considerCell(p.x, p.y, p.mass);
    for (let oi = 0; oi < bots.length; oi++) {
      if (oi === bi) continue;
      const other = bots[oi];
      if (!other) continue;
      considerCell(other.x, other.y, other.mass);
    }

    let bestIdx = -1;
    let bestD2 = Number.POSITIVE_INFINITY;
    if (
      preyD2 === Number.POSITIVE_INFINITY &&
      threatD2 === Number.POSITIVE_INFINITY
    ) {
      for (let fi = 0; fi < food.length; fi++) {
        const pp = food[fi];
        if (!pp) continue;
        const ex = pp.x - bot.x;
        const ey = pp.y - bot.y;
        const d2 = ex * ex + ey * ey;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestIdx = fi;
        }
      }
    }

    let bx = bot.x;
    let by = bot.y;
    if (preyD2 !== Number.POSITIVE_INFINITY) {
      const adx = Math.abs(preyDx);
      const ady = Math.abs(preyDy);
      if (adx >= ady) {
        bx += preyDx >= 0 ? BOT_SPEED : -BOT_SPEED;
      } else {
        by += preyDy >= 0 ? BOT_SPEED : -BOT_SPEED;
      }
    } else if (threatD2 !== Number.POSITIVE_INFINITY) {
      const adx = Math.abs(threatDx);
      const ady = Math.abs(threatDy);
      if (adx >= ady) {
        bx += threatDx >= 0 ? -BOT_SPEED : BOT_SPEED;
      } else {
        by += threatDy >= 0 ? -BOT_SPEED : BOT_SPEED;
      }
    } else if (bestIdx !== -1) {
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
      }
    }
    bx = clamp(bx, botR, WORLD_W - botR);
    by = clamp(by, botR, WORLD_H - botR);

    let bmass = bot.mass;
    for (let fi = 0; fi < food.length; fi++) {
      const pp = food[fi];
      if (!pp) continue;
      const ddx = pp.x - bx;
      const ddy = pp.y - by;
      const reach = radiusForMass(bmass) + FOOD_R;
      if (ddx * ddx + ddy * ddy <= reach * reach) {
        bmass = addMass(bmass, 1);
        const out = spawnPellet(rng);
        rng = out.rng;
        food[fi] = out.pellet;
      }
    }

    bots[bi] = { id: bot.id, x: bx, y: by, mass: bmass };
  }

  // 3. Cell-eats-cell pass. Order: player-pairs (i<j) → bot-pairs
  //    (i<j) → player×bot. The player×player pass IS the slice-4
  //    multiplayer frontier (issue #300) — the same overlap rule as
  //    player×bot, applied symmetrically.
  //
  //    Per-tick guards: `playerEaten[i]` marks a player who was
  //    absorbed this tick (skip further pairs against them);
  //    `botRespawned[i]` mirrors the existing bot guard. A player
  //    absorbed this tick respawns at a fresh deterministic position
  //    with mass=PLAYER_MASS_START; the eater grows by the eaten's
  //    mass (saturating at MAX_MASS).
  const playerEaten = new Array<boolean>(players.length).fill(false);
  const botRespawned = new Array<boolean>(bots.length).fill(false);

  function respawnPlayer(p: PlayerState): PlayerState {
    const out = spawnPellet(rng);
    rng = out.rng;
    return {
      id: p.id,
      x: out.pellet.x,
      y: out.pellet.y,
      mass: PLAYER_MASS_START,
      deaths: p.deaths + 1,
      bestMass: p.bestMass,
    };
  }

  function respawnBot(bot: BotState): BotState {
    const out = spawnPellet(rng);
    rng = out.rng;
    return {
      id: bot.id,
      x: out.pellet.x,
      y: out.pellet.y,
      mass: PLAYER_MASS_START,
    };
  }

  // 3a. Player vs player — symmetric, stable (i,j) order with i<j.
  for (let i = 0; i < players.length; i++) {
    if (playerEaten[i]) continue;
    for (let j = i + 1; j < players.length; j++) {
      if (playerEaten[i]) break;
      if (playerEaten[j]) continue;
      const a = players[i];
      const b = players[j];
      if (!a || !b) continue;
      const ddx = b.x - a.x;
      const ddy = b.y - a.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (a.mass >= b.mass * EAT_RATIO) {
        const ar = radiusForMass(a.mass);
        if (d2 < ar * ar) {
          const grownMass = addMass(a.mass, b.mass);
          players[i] = {
            id: a.id,
            x: a.x,
            y: a.y,
            mass: grownMass,
            deaths: a.deaths,
            bestMass: a.bestMass > grownMass ? a.bestMass : grownMass,
          };
          players[j] = respawnPlayer(b);
          playerEaten[j] = true;
          continue;
        }
      }
      if (b.mass >= a.mass * EAT_RATIO) {
        const br = radiusForMass(b.mass);
        if (d2 < br * br) {
          const grownMass = addMass(b.mass, a.mass);
          players[j] = {
            id: b.id,
            x: b.x,
            y: b.y,
            mass: grownMass,
            deaths: b.deaths,
            bestMass: b.bestMass > grownMass ? b.bestMass : grownMass,
          };
          players[i] = respawnPlayer(a);
          playerEaten[i] = true;
          break;
        }
      }
    }
  }

  // 3b. Bot vs bot.
  for (let i = 0; i < bots.length; i++) {
    if (botRespawned[i]) continue;
    const a = bots[i];
    if (!a) continue;
    for (let j = i + 1; j < bots.length; j++) {
      if (botRespawned[i]) break;
      if (botRespawned[j]) continue;
      const b = bots[j];
      if (!b) continue;
      const ddx = b.x - a.x;
      const ddy = b.y - a.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (a.mass >= b.mass * EAT_RATIO) {
        const ar = radiusForMass(a.mass);
        if (d2 < ar * ar) {
          bots[i] = { id: a.id, x: a.x, y: a.y, mass: addMass(a.mass, b.mass) };
          bots[j] = respawnBot(b);
          botRespawned[j] = true;
          continue;
        }
      }
      if (b.mass >= a.mass * EAT_RATIO) {
        const br = radiusForMass(b.mass);
        if (d2 < br * br) {
          bots[j] = { id: b.id, x: b.x, y: b.y, mass: addMass(b.mass, a.mass) };
          bots[i] = respawnBot(a);
          botRespawned[i] = true;
          break;
        }
      }
    }
  }

  // 3c. Player vs bot — players in id-order outer, bots index inner.
  for (let pi = 0; pi < players.length; pi++) {
    if (playerEaten[pi]) continue;
    const p = players[pi];
    if (!p) continue;
    for (let bi = 0; bi < bots.length; bi++) {
      if (botRespawned[bi]) continue;
      const bot = bots[bi];
      if (!bot) continue;
      const ddx = bot.x - p.x;
      const ddy = bot.y - p.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (p.mass >= bot.mass * EAT_RATIO) {
        const pr = radiusForMass(p.mass);
        if (d2 < pr * pr) {
          const grownMass = addMass(p.mass, bot.mass);
          players[pi] = {
            id: p.id,
            x: p.x,
            y: p.y,
            mass: grownMass,
            deaths: p.deaths,
            bestMass: p.bestMass > grownMass ? p.bestMass : grownMass,
          };
          bots[bi] = respawnBot(bot);
          botRespawned[bi] = true;
          continue;
        }
      }
      if (bot.mass >= p.mass * EAT_RATIO) {
        const br = radiusForMass(bot.mass);
        if (d2 < br * br) {
          bots[bi] = {
            id: bot.id,
            x: bot.x,
            y: bot.y,
            mass: addMass(bot.mass, p.mass),
          };
          players[pi] = respawnPlayer(p);
          playerEaten[pi] = true;
          break;
        }
      }
    }
  }

  // 4. Decay pass. Applied to all players and bots after eats.
  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    if (!p) continue;
    const decayed = applyDecay(p.mass);
    if (decayed !== p.mass) {
      players[pi] = {
        id: p.id,
        x: p.x,
        y: p.y,
        mass: decayed,
        deaths: p.deaths,
        bestMass: p.bestMass,
      };
    }
  }
  for (let bi = 0; bi < bots.length; bi++) {
    const b = bots[bi];
    if (!b) continue;
    const decayed = applyDecay(b.mass);
    if (decayed !== b.mass) {
      bots[bi] = { id: b.id, x: b.x, y: b.y, mass: decayed };
    }
  }

  // 5. Once-per-tick rng advance (preserves the slice-1/2 invariant
  //    that rng moves even in the no-eat case).
  rng = advance(rng);

  return {
    tick: state.tick + 1,
    players,
    food,
    bots,
    rng,
  };
}

// Replay an ordered tape of ReplayFrames from a seed and return the
// terminal state. Pure. The convergence harness builds the tape from
// snapshots (each snapshot carries the joins/leaves/inputs that
// produced it) and asserts pureReplay(seed, tape) === canonical.
export function pureReplay(seed: number, tape: readonly ReplayFrame[]): WorldState {
  let s = initialState(seed);
  for (const f of tape) s = step(s, f);
  return s;
}
