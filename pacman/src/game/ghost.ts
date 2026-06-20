// The ghost quartet — Blinky, Pinky, Inky, Clyde.
//
// Each ghost shares the same per-tile AI shell (mode timer + greedy
// neighbor pick that minimises squared distance to a target tile,
// arcade tie-break up>left>down>right, no 180° reversals). What makes
// them feel distinct is the TARGET TILE — and each ghost computes that
// differently. Those targeting rules are the load-bearing bit, so they
// live as PURE, EXPORTED functions: easy to call from a unit test with
// hand-crafted inputs.
//
// Targeting rules (arcade-canonical):
//   • Blinky: chases Pac's current tile.
//   • Pinky:  ambushes 4 tiles ahead of Pac's facing direction.
//             (We omit the original "up" overflow bug — not needed for
//             the harness contract.)
//   • Inky:   uses Blinky as a pivot. Take the tile 2 ahead of Pac,
//             then double the vector FROM Blinky TO that pivot.
//   • Clyde:  chases Pac when far (>8 tiles), flees to his corner
//             when close. Famously cowardly.
// All four fall back to a fixed corner during SCATTER.
//
// House-exit timing is gated by the GLOBAL DOT COUNTER (pellets eaten
// since boot). Blinky starts already out. Pinky leaves at 7, Inky at
// 17, Clyde at 32 — matches the arcade thresholds closely enough for
// a believable stagger without porting the full per-ghost counter.

import { COLS, MAZE, ROWS } from "./maze";
import type { Direction, GameState } from "./types";

export type GhostMode = "scatter" | "chase" | "frightened" | "eaten";
export type GhostName = "blinky" | "pinky" | "inky" | "clyde";

/** Duration of a single frightened activation, in ticks. Arcade-canonical
 *  ~6s at 60 Hz. Eating another power pellet RE-arms it (resets to this). */
export const FRIGHTENED_TICKS = 360;
/** Ghost-house revive tile — where an 'eaten' ghost respawns and re-enters
 *  the roster. Matches the Pinky/Inky/Clyde house anchor row. */
export const REVIVE_TILE = { x: 13, y: 14 } as const;

/** Public ghost state — mirrored onto `window.__pac.ghosts`. Keep this
 *  small; the e2e contract only needs name, tile coords, and mode.
 *
 *  Render-probe fields (`nextX`, `nextY`, `_progress`) are appended so
 *  the feel-correctness e2e (issue #137) can compute the exact lerp the
 *  canvas renderer paints, without OCR'ing pixels. They are NOT part
 *  of the AI / collision contract — collision still uses (x, y) only. */
export interface GhostState {
  name: GhostName;
  /** Tile column. */
  x: number;
  /** Tile row. */
  y: number;
  mode: GhostMode;
  /** Tile the ghost is heading toward (render-probe only). */
  nextX: number;
  /** Tile the ghost is heading toward (render-probe only). */
  nextY: number;
  /** Sub-tile glide progress 0..1 (render-probe only). */
  _progress: number;
}

/** Where a ghost is in its lifecycle. "house" = waiting inside the
 *  ghost-house, gated by the dot counter. "out" = roaming the maze. */
export type GhostStatus = "house" | "out";

/** Internal ghost — adds the bits the AI needs but the test contract
 *  doesn't care about. The engine stores these; we publish the slim
 *  GhostState shape onto the state.
 *
 *  GhostState now also carries `nextX, nextY, _progress` so the feel-
 *  correctness e2e (issue #137) can verify the canvas-render lerp
 *  without OCR'ing pixels — those three fields live on the base
 *  interface, not duplicated here. */
export interface GhostInternal extends GhostState {
  /** Direction last moved in, used to forbid 180° reversals. */
  lastDir: Dir;
  /** "house" until the dot-counter releases this ghost; then "out". */
  status: GhostStatus;
  /** Dot-counter threshold for leaving the house. Blinky = 0. */
  releaseAtPellets: number;
}

type Dir = "up" | "down" | "left" | "right";
const DIRS: readonly Dir[] = ["up", "down", "left", "right"] as const;

/** Tiles per tick. Slightly slower than Pac (0.12) so chase tension
 *  builds without being immediately lethal. */
const GHOST_SPEED_PER_TICK = 0.10;
/** Frightened ghosts shuffle: half-speed, no homing. */
const FRIGHTENED_SPEED_PER_TICK = 0.05;
/** Eaten ghosts (eyes) race back to the house at double speed. */
const EATEN_SPEED_PER_TICK = 0.20;

/** Mode period, in ticks. 60 ticks/s × 5s = 300 ticks per phase. */
export const MODE_PERIOD_TICKS = 300;

/** Scatter corners — one per ghost, arcade-canonical. */
const SCATTER_CORNERS: Record<GhostName, { x: number; y: number }> = {
  blinky: { x: COLS - 2, y: 0 }, // top-right
  pinky: { x: 1, y: 0 }, // top-left
  inky: { x: COLS - 1, y: ROWS - 1 }, // bottom-right
  clyde: { x: 0, y: ROWS - 1 }, // bottom-left
};

/** Spawn tiles. Blinky boots already out (top of the house). The other
 *  three boot inside the house — the dot counter releases them. */
const SPAWN_TILES: Record<GhostName, { x: number; y: number }> = {
  blinky: { x: 13, y: 11 },
  pinky: { x: 13, y: 14 },
  inky: { x: 11, y: 14 },
  clyde: { x: 15, y: 14 },
};

/** Dot-counter thresholds for house exit. Arcade-true enough. */
const RELEASE_THRESHOLDS: Record<GhostName, number> = {
  blinky: 0,
  pinky: 7,
  inky: 17,
  clyde: 32,
};

/** Reverse of a direction (for the "no 180°" rule). */
function opposite(d: Dir): Dir {
  switch (d) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

function step(x: number, y: number, d: Dir): { x: number; y: number } {
  switch (d) {
    case "up":
      return { x, y: y - 1 };
    case "down":
      return { x, y: y + 1 };
    case "left":
      return { x: x - 1, y };
    case "right":
      return { x: x + 1, y };
  }
}

/** Tunnel-row wrap, same rule as Pac. */
function wrap(x: number, y: number): { x: number; y: number } {
  if (y !== 14) return { x, y };
  if (x < 0) return { x: COLS - 1, y };
  if (x >= COLS) return { x: 0, y };
  return { x, y };
}

/** A ghost can pass through every non-wall tile, including the ghost-
 *  house door (real arcade: only when leaving / re-entering). We treat
 *  the door as walkable to keep this slice simple. */
function isWalkableForGhost(x: number, y: number): boolean {
  if (y === 14 && (x < 0 || x >= COLS)) return true;
  if (y < 0 || y >= ROWS) return false;
  if (x < 0 || x >= COLS) return false;
  const ch = MAZE[y][x];
  return ch !== "#";
}

/** Squared distance — Pac AI is famous for using straight Euclidean
 *  squared distance for the targeting decision (no sqrt needed). */
function sqDist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Unit vector for a Direction, in tile coords. 'none' → (0,0). */
function dirVector(d: Direction): { dx: number; dy: number } {
  switch (d) {
    case "up":
      return { dx: 0, dy: -1 };
    case "down":
      return { dx: 0, dy: 1 };
    case "left":
      return { dx: -1, dy: 0 };
    case "right":
      return { dx: 1, dy: 0 };
    case "none":
      return { dx: 0, dy: 0 };
  }
}

// ---------------------------------------------------------------------------
// Targeting functions — pure, exported, individually unit-testable.
// Each takes the minimal inputs it needs. They never read the maze;
// targets are allowed to land on walls — the greedy picker still chooses
// the best WALKABLE neighbor toward that target, exactly like the arcade.
// ---------------------------------------------------------------------------

/** Blinky targets Pac's current tile. */
export function blinkyTarget(pac: { x: number; y: number }): { x: number; y: number } {
  return { x: pac.x, y: pac.y };
}

/** Pinky targets 4 tiles ahead of Pac in his facing direction. */
export function pinkyTarget(pac: {
  x: number;
  y: number;
  dir: Direction;
}): { x: number; y: number } {
  const v = dirVector(pac.dir);
  return { x: pac.x + v.dx * 4, y: pac.y + v.dy * 4 };
}

/** Inky targets the tile reached by doubling the Blinky→pivot vector,
 *  where pivot = 2 tiles ahead of Pac. */
export function inkyTarget(
  pac: { x: number; y: number; dir: Direction },
  blinky: { x: number; y: number },
): { x: number; y: number } {
  const v = dirVector(pac.dir);
  const pivot = { x: pac.x + v.dx * 2, y: pac.y + v.dy * 2 };
  return { x: pivot.x + (pivot.x - blinky.x), y: pivot.y + (pivot.y - blinky.y) };
}

/** Clyde chases Pac when his squared distance is > 64 (>8 tiles),
 *  otherwise flees to his scatter corner. */
export function clydeTarget(
  clyde: { x: number; y: number },
  pac: { x: number; y: number },
): { x: number; y: number } {
  if (sqDist(clyde.x, clyde.y, pac.x, pac.y) > 64) {
    return { x: pac.x, y: pac.y };
  }
  return SCATTER_CORNERS.clyde;
}

/** Scatter target for any ghost by name. */
export function scatterTarget(name: GhostName): { x: number; y: number } {
  return SCATTER_CORNERS[name];
}

/** Build the initial ghost roster — all four ghosts, with Blinky out
 *  and the others gated by the dot counter. */
export function spawnGhosts(): GhostInternal[] {
  const make = (name: GhostName, status: GhostStatus, lastDir: Dir): GhostInternal => ({
    name,
    x: SPAWN_TILES[name].x,
    y: SPAWN_TILES[name].y,
    mode: "scatter",
    lastDir,
    _progress: 0,
    // At spawn the ghost is stationary on its tile — next == current.
    // The first tickGhost call (once `status === "out"`) will pick a
    // real `nextX, nextY` before any glide progress accumulates.
    nextX: SPAWN_TILES[name].x,
    nextY: SPAWN_TILES[name].y,
    status,
    releaseAtPellets: RELEASE_THRESHOLDS[name],
  });
  return [
    make("blinky", "out", "left"),
    make("pinky", "house", "up"),
    make("inky", "house", "up"),
    make("clyde", "house", "up"),
  ];
}

/** Decide a ghost's current target tile from mode + game state. */
function targetFor(
  g: GhostInternal,
  state: GameState,
  blinky: { x: number; y: number } | null,
): { x: number; y: number } {
  if (g.mode === "scatter") return scatterTarget(g.name);
  const pac = { x: state.pac.x, y: state.pac.y, dir: state.pac.dir };
  switch (g.name) {
    case "blinky":
      return blinkyTarget(pac);
    case "pinky":
      return pinkyTarget(pac);
    case "inky":
      // Fallback to Blinky's own position if Blinky isn't in the roster
      // (shouldn't happen in normal play, but the targeting fn is total).
      return inkyTarget(pac, blinky ?? { x: pac.x, y: pac.y });
    case "clyde":
      return clydeTarget({ x: g.x, y: g.y }, pac);
  }
}

/** Pick the best non-reversing walkable neighbor for `g`. Ties broken
 *  by the canonical arcade preference order: up, left, down, right. */
function pickDirection(g: GhostInternal, target: { x: number; y: number }): Dir {
  const forbid = opposite(g.lastDir);
  // Arcade tie-break preference: up > left > down > right.
  const PREF: readonly Dir[] = ["up", "left", "down", "right"];

  let best: Dir | null = null;
  let bestDist = Infinity;
  for (const d of PREF) {
    if (d === forbid) continue;
    const s = step(g.x, g.y, d);
    const n = wrap(s.x, s.y);
    if (!isWalkableForGhost(n.x, n.y)) continue;
    const dist = sqDist(n.x, n.y, target.x, target.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }

  // Dead end (no non-reversing option): allow the reversal.
  if (best === null) {
    for (const d of DIRS) {
      const s = step(g.x, g.y, d);
      const n = wrap(s.x, s.y);
      if (isWalkableForGhost(n.x, n.y)) return d;
    }
    // Fully boxed in (shouldn't happen on the real maze). Hold still.
    return g.lastDir;
  }
  return best;
}

/** Compute pellets-eaten since boot — used as the dot counter. */
function pelletsEaten(state: GameState, totalPelletsAtBoot: number): number {
  return totalPelletsAtBoot - state.pellets;
}

/** Deterministic per-ghost "random" direction for frightened mode. We
 *  want behaviour that's reproducible across machines (the e2e harness
 *  counts on that) but distinct per ghost — so the four don't herd into
 *  the same corridor. Hash (tick, name) into a direction preference. */
function frightenedDir(g: GhostInternal, tick: number): Dir {
  // Cheap hash — name index + tick — mod 4 → pick a starting direction.
  const idx = (["blinky", "pinky", "inky", "clyde"] as const).indexOf(g.name);
  const h = (tick * 31 + idx * 17) >>> 0;
  const forbid = opposite(g.lastDir);
  // Try each direction in shifted order; pick the first non-reversing
  // walkable one. Falls through to allow a reversal at a dead end.
  for (let i = 0; i < 4; i += 1) {
    const d = DIRS[(h + i) % 4];
    if (d === forbid) continue;
    const s = step(g.x, g.y, d);
    const n = wrap(s.x, s.y);
    if (isWalkableForGhost(n.x, n.y)) return d;
  }
  for (const d of DIRS) {
    const s = step(g.x, g.y, d);
    const n = wrap(s.x, s.y);
    if (isWalkableForGhost(n.x, n.y)) return d;
  }
  return g.lastDir;
}

/** One tick of ghost AI. Mutates the ghost in place; updates mode based
 *  on the engine tick. The engine is responsible for re-publishing the
 *  slim view onto state.ghosts after each tick.
 *
 *  `frightenedTicksLeft` is engine-owned: when > 0, all non-eaten ghosts
 *  flip to 'frightened'. When it hits 0, they revert to the scatter/chase
 *  phase derived from `state.tick`. Ghosts in mode 'eaten' ignore the
 *  frightened timer — they keep their eyes-only race back to the house. */
export function tickGhost(
  g: GhostInternal,
  state: GameState,
  blinky: { x: number; y: number } | null,
  totalPelletsAtBoot: number,
  frightenedTicksLeft: number,
  speedMultiplier: number,
): void {
  // 1. Mode resolution. Priority: eaten > frightened > scatter/chase.
  if (g.mode !== "eaten") {
    if (frightenedTicksLeft > 0) {
      g.mode = "frightened";
    } else {
      const phase = Math.floor(state.tick / MODE_PERIOD_TICKS) % 2;
      g.mode = phase === 0 ? "scatter" : "chase";
    }
  }

  // 2. House gating. While "house", count pellets and step out when the
  //    threshold is crossed. Movement inside the house is intentionally
  //    skipped — a simple stagger that's easy to reason about and lets
  //    the e2e watch the roster grow into the maze deterministically.
  if (g.status === "house") {
    if (pelletsEaten(state, totalPelletsAtBoot) >= g.releaseAtPellets) {
      // Step out the door onto the lip tile above the house.
      g.x = 13;
      g.y = 11;
      g.status = "out";
      g.lastDir = "left";
      g._progress = 0;
      // Re-pin next-tile to match the just-set current tile; the next
      // tick's traversal-setup branch (below) will pick a real next.
      g.nextX = g.x;
      g.nextY = g.y;
    }
    return;
  }

  // 3. Traversal setup (issue #137 — render continuity at corners).
  //    If the ghost is sitting on its current tile with no next picked
  //    yet (progress === 0 and next == current), choose the next-tile
  //    NOW, before any glide progress accumulates. Then the render can
  //    lerp (x, y) → (nextX, nextY) by `_progress` cleanly across the
  //    whole 0→1 window. The OLD design picked direction AT the commit
  //    moment AND advanced (x, y) in the same tick — which made the
  //    render extrapolate `x + lastDir * progress` across a direction
  //    flip and teleport at corners.
  //
  //    This branch also handles the rare "next was a wall" case: if a
  //    previous tick somehow left next == current (e.g. fully boxed in,
  //    or the post-commit pick below hit the dead-end fallback), we
  //    re-pick here.
  if (g._progress === 0 && g.nextX === g.x && g.nextY === g.y) {
    pickNext(g, state, blinky);
  }

  // 4. Advance sub-tile progress at the mode-appropriate speed.
  //    `speedMultiplier` lets the engine bump baseline ghost speed
  //    each time the level resets (see Engine.handleLevelWon). Frightened
  //    + eaten modes are intentionally unscaled — keeping those constant
  //    preserves the power-pellet escape window across levels.
  const baseSpeed =
    g.mode === "frightened"
      ? FRIGHTENED_SPEED_PER_TICK
      : g.mode === "eaten"
      ? EATEN_SPEED_PER_TICK
      : GHOST_SPEED_PER_TICK;
  const speed =
    g.mode === "frightened" || g.mode === "eaten"
      ? baseSpeed
      : baseSpeed * speedMultiplier;
  g._progress += speed;
  if (g._progress < 1) return;
  g._progress -= 1;

  // 5. Commit the move — (x, y) snaps to (nextX, nextY). The render
  //    continuity invariant: at the exact moment of commit, the old
  //    lerp endpoint (the previous nextX, nextY) becomes the new lerp
  //    start (the new x, y). No teleport, even when the upcoming pick
  //    flips direction by 90°.
  g.x = g.nextX;
  g.y = g.nextY;

  // 6. If an eaten ghost reaches the revive tile, revive: status flips
  //    back to "out" and mode resolves to the current chase/scatter phase
  //    on the next tick. (We do NOT send it back to "house" + dot gate —
  //    those thresholds are for the initial release, not respawns.)
  if (g.mode === "eaten" && g.x === REVIVE_TILE.x && g.y === REVIVE_TILE.y) {
    const phase = Math.floor(state.tick / MODE_PERIOD_TICKS) % 2;
    g.mode = phase === 0 ? "scatter" : "chase";
    g.lastDir = "up";
    g._progress = 0;
    // Re-pin so the next tick's setup branch picks fresh after revive.
    g.nextX = g.x;
    g.nextY = g.y;
    return;
  }

  // 7. Pick the next-tile for the upcoming traversal. We do this NOW,
  //    on the commit tick, so the leftover `_progress` (~0.05) already
  //    represents progress toward the freshly-picked next-tile — the
  //    render's first frame after commit is a tiny lerp from the just-
  //    arrived tile toward the new next, which connects perfectly to
  //    the last frame before commit (which was nearly at the just-
  //    arrived tile).
  pickNext(g, state, blinky);
}

/** Pick the next-tile a ghost is heading toward, updating `lastDir` +
 *  `nextX, nextY` in place. Pure decision over current `g.x, g.y, mode,
 *  lastDir` and the game state. Does NOT touch `_progress` — the caller
 *  decides whether this is start-of-traversal (progress untouched) or
 *  mid-traversal (won't happen in normal flow). */
function pickNext(
  g: GhostInternal,
  state: GameState,
  blinky: { x: number; y: number } | null,
): void {
  let dir: Dir;
  if (g.mode === "frightened") {
    dir = frightenedDir(g, state.tick);
  } else if (g.mode === "eaten") {
    dir = pickDirection(g, REVIVE_TILE);
  } else {
    const target = targetFor(g, state, blinky);
    dir = pickDirection(g, target);
  }
  const s = step(g.x, g.y, dir);
  const next = wrap(s.x, s.y);
  if (!isWalkableForGhost(next.x, next.y)) {
    // Fully boxed in — hold position. Leaves next == current so the
    // setup branch re-picks next tick (when targets / mode may shift).
    g.nextX = g.x;
    g.nextY = g.y;
    return;
  }
  g.nextX = next.x;
  g.nextY = next.y;
  g.lastDir = dir;
}

/** Strip a GhostInternal down to the public contract shape. */
export function publicGhostView(g: GhostInternal): GhostState {
  return {
    name: g.name,
    x: g.x,
    y: g.y,
    mode: g.mode,
    nextX: g.nextX,
    nextY: g.nextY,
    _progress: g._progress,
  };
}

/** Back-compat alias — older code paths still importing `spawnBlinky`. */
export function spawnBlinky(): GhostInternal {
  return spawnGhosts()[0];
}
