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
// What the world looks like in slice 3:
//   - ONE player (the single connected client). Slice 4 generalises to N.
//   - Position is a {x, y} pair in canvas pixels (640x640, matches the
//     `<canvas>` in agar/index.html). Walls at the edges clamp motion.
//   - Speed is 4 px / tick (= 80 px / s at 20Hz). Big enough for the
//     e2e to see motion in a handful of ticks, small enough that a
//     tape of ~30 inputs stays inside the canvas.
//
// The RNG isn't actually CONSUMED by motion in this slice — motion is
// deterministic from inputs alone. The seeded RNG exists so the
// state shape already carries the determinism scaffolding that
// agar-04 (food spawn) will need. We advance it once per tick anyway,
// so the e2e proves the seed is wired end-to-end.

export type InputDir = "none" | "up" | "down" | "left" | "right";

export interface InputIntent {
  dir: InputDir;
}

export interface PlayerState {
  x: number;
  y: number;
}

export interface WorldState {
  tick: number;
  player: PlayerState;
  // 32-bit unsigned RNG state, advanced once per tick. Exposed so the
  // offline reducer can assert the DO is using the same seed.
  rng: number;
}

// Canvas extent — must stay in sync with agar/index.html `<canvas>`.
export const WORLD_W = 640;
export const WORLD_H = 640;
export const PLAYER_R = 16;
export const SPEED = 4;

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

export function initialState(seed: number): WorldState {
  // Seed is normalised to a 32-bit unsigned int so callers can pass any
  // number (including the test harness's `parseInt` outputs) without
  // worrying about float coercion.
  const rng = (seed >>> 0) || 1;
  return {
    tick: 0,
    player: { x: WORLD_W / 2, y: WORLD_H / 2 },
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

  const nx = clamp(state.player.x + dx, PLAYER_R, WORLD_W - PLAYER_R);
  const ny = clamp(state.player.y + dy, PLAYER_R, WORLD_H - PLAYER_R);

  return {
    tick: state.tick + 1,
    player: { x: nx, y: ny },
    rng: advance(state.rng),
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
