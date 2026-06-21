// agar — slice 4/4 pure reducer (N-player roster).
//
// THE RUNG: this is the multi-client reducer. Slice 3's single-`player`
// shape is gone; the world now carries a `players` Record keyed by
// `clientId`, populated as sockets join. The DO applies inputs in
// canonical (tick, clientId-lex, seq) order; the client mirrors the
// applied keys into `window.__game.appliedLog` so the e2e's
// `expectOrderingInvariant` has the `tick:clientId:seq` shape it
// requires (see e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md).
//
// Determinism contract (unchanged from slice 3, generalised to N):
//   - `step(state, input)` is pure: same (state, input) → same next
//     state. No reads of wall-clock, no global RNG.
//   - All randomness flows through `state.rng`, a 32-bit mulberry-style
//     PRNG seeded once at `initialState(seed)`. Reseeding mid-run is
//     not supported — the seed is a per-match constant.
//   - Roster joins are deterministic: `applyJoin(state, clientId)`
//     inserts a player at the canvas centre with zero velocity. Joining
//     twice with the same id is a no-op (idempotent — the DO may
//     re-call it on reconnect-replay).
//   - Inputs name the actor: `InputEvent.clientId` is the player the
//     input belongs to. An input for an unknown clientId is a no-op
//     (the reducer never throws on bad input — the DO trusts the wire,
//     but the reducer is the contract).
//
// What the world looks like in slice 4:
//   - N players. Each is a {x, y} pair in canvas pixels (640x640).
//     Walls at the edges clamp motion.
//   - Speed unchanged at 4 px / tick.
//   - The applied-input log lives on the SERVER (the DO appends each
//     event's `${tick}:${clientId}:${seq}` key); the client receives
//     the delta in each snapshot and mirrors it. This is the key shape
//     `e2e-shared/multiplayer/playwright-binding.ts:expectOrderingInvariant`
//     requires; a single-client `InputDir[]` log would be rejected by
//     shape, with a precise error.

export type InputDir = "none" | "up" | "down" | "left" | "right";

/** Backwards-compat alias retained for `agar/e2e/tick.spec.ts`, which
 *  treats one client as a degenerate roster. New callers should use
 *  `InputEvent` (which carries clientId + seq) directly. */
export interface InputIntent {
  dir: InputDir;
}

/** A canonical multi-client input event. The DO applies these in
 *  (tick, clientId-lex, seq) order. */
export interface InputEvent {
  clientId: string;
  seq: number;
  dir: InputDir;
}

export interface PlayerState {
  x: number;
  y: number;
}

export interface WorldState {
  tick: number;
  /** Roster keyed by clientId. Players join via `applyJoin`. Insertion
   *  order is irrelevant to canonical equality — `structuralEquals`
   *  compares key sets unordered. */
  players: Record<string, PlayerState>;
  /** 32-bit unsigned RNG state, advanced once per tick. */
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
  let t = (s + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

export function initialState(seed: number): WorldState {
  const rng = (seed >>> 0) || 1;
  return {
    tick: 0,
    players: {},
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

/** Insert a player at the canvas centre. Idempotent — re-joining with
 *  the same clientId returns the same state object so the DO can call
 *  this on reconnect-replay without resetting position. */
export function applyJoin(state: WorldState, clientId: string): WorldState {
  if (Object.prototype.hasOwnProperty.call(state.players, clientId)) {
    return state;
  }
  return {
    ...state,
    players: {
      ...state.players,
      [clientId]: { x: WORLD_W / 2, y: WORLD_H / 2 },
    },
  };
}

/** Apply one input event to the named player. No-op (returns the same
 *  state) if the clientId isn't in the roster. Does NOT advance tick —
 *  tick advances once per tick boundary, after ALL inputs for that tick
 *  have been applied in canonical order. */
export function applyInput(state: WorldState, ev: InputEvent): WorldState {
  const cur = state.players[ev.clientId];
  if (!cur) return state;
  const dir = normalizeDir(ev.dir);
  let dx = 0;
  let dy = 0;
  if (dir === "left") dx = -SPEED;
  else if (dir === "right") dx = SPEED;
  else if (dir === "up") dy = -SPEED;
  else if (dir === "down") dy = SPEED;
  const nx = clamp(cur.x + dx, PLAYER_R, WORLD_W - PLAYER_R);
  const ny = clamp(cur.y + dy, PLAYER_R, WORLD_H - PLAYER_R);
  return {
    ...state,
    players: {
      ...state.players,
      [ev.clientId]: { x: nx, y: ny },
    },
  };
}

/** Close a tick: increment tick counter, advance RNG once. Called by
 *  the DO at the tick boundary AFTER all canonical-ordered inputs for
 *  that tick have been applied via `applyInput`. */
export function closeTick(state: WorldState): WorldState {
  return {
    ...state,
    tick: state.tick + 1,
    rng: advance(state.rng),
  };
}

/** Apply a batch of events that all share the same `tick` field, in
 *  canonical (clientId-lex, seq) order, then close the tick. This is
 *  the function the DO drives per tick boundary; it's also what
 *  `pureReplay` calls per tick group, so server and offline agree
 *  byte-for-byte. */
export function applyTickBatch(
  state: WorldState,
  events: readonly InputEvent[],
): WorldState {
  const ordered = [...events].sort((a, b) => {
    if (a.clientId !== b.clientId) return a.clientId < b.clientId ? -1 : 1;
    return a.seq - b.seq;
  });
  let s = state;
  for (const ev of ordered) {
    s = applyInput(s, ev);
  }
  return closeTick(s);
}

// ──────────────────────────────────────────────────────────────────────
// Slice-3 compat: the single-client `tick.spec.ts` still drives the DO
// through `__game.sendInput(dir)`. The DO turns that into an
// `InputEvent` for the implicit clientId. `step(state, { dir })` is the
// 1-event-per-tick shorthand the single-client spec uses to replay
// against the server's state.
//
// Why keep this around: slice 3's e2e tests determinism by replaying
// the appliedLog through a pure reducer. That replay is one input per
// tick, single-client — exactly what `step` does. Removing it would
// force a rewrite of the slice-3 spec just to prove slice-3 invariants.
// ──────────────────────────────────────────────────────────────────────
export function step(state: WorldState, input: InputIntent): WorldState {
  // Single-client step assumes the first (and only) roster member is
  // the actor. If the roster is empty it auto-joins under a stable
  // pseudo-id so `tick.spec.ts`'s flow ("connect, send inputs, replay")
  // still works without the spec naming an id.
  const ids = Object.keys(state.players);
  const id = ids.length > 0 ? ids[0]! : "_solo";
  let s = state;
  if (ids.length === 0) s = applyJoin(s, id);
  s = applyInput(s, { clientId: id, seq: s.tick, dir: input.dir });
  return closeTick(s);
}

/** Slice-3 convenience: replay a single-client tape from seed.
 *  Each entry is treated as the next tick's input for the implicit
 *  solo player. Used by `agar/e2e/tick.spec.ts` only. */
export function pureReplay(
  seed: number,
  tape: readonly InputIntent[],
): WorldState {
  let s = initialState(seed);
  for (const i of tape) s = step(s, i);
  return s;
}
