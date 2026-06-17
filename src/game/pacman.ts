// Pac-Man entity + tile movement.
//
// Movement model (the *feel*): Pac lives on the tile grid, but glides
// between tiles via a sub-tile progress counter. Each `update()` call
// advances progress by SPEED_PER_TICK; when progress hits 1.0 we commit
// the move — Pac is now centered on the next tile, eats a pellet if one
// is there, and re-evaluates direction.
//
// Two directions are tracked: `dir` (currently moving) and `queued`
// (the player's most recent intent). At each tile boundary we *try* to
// honor `queued` first — that's the classic "pre-turn at a corner"
// responsiveness. If `queued` is blocked by a wall we fall through to
// `dir`; if that's also blocked, Pac stops at the tile center until the
// player nudges a viable direction. That last bit is what keeps the
// character from feeling like it's hitting the wall — it's *waiting*.
//
// Tunnels: row 14 wraps horizontally. Off the left edge → COLS-1, off
// the right edge → 0. Pellets do not exist on tunnel rows by layout.

import { COLS, MAZE } from "./maze";
import type { Direction, GameState, PacState } from "./types";

/** Tiles per tick. 60 ticks/sec * 0.12 ≈ 7.2 tiles/sec — feels close to
 *  arcade Pac (which is ~75 tiles/sec at the original scale, then visually
 *  much slower because tiles are larger here). Tunable. */
const SPEED_PER_TICK = 0.12;

/** Classic-ish spawn: row 23, in the open gap left of center. From here
 *  the very next tile right is a pellet, which is what the e2e relies on. */
const SPAWN_X = 13;
const SPAWN_Y = 23;

/** Pellet map: mutable mirror of the static MAZE for tiles that *contain*
 *  food. `true` = pellet present, `false` = eaten. Indexed [row][col].
 *  Power pellets ('o') are tracked too — same eat mechanic, scoring will
 *  diverge in a later slice. */
export type PelletMap = boolean[][];

export function buildPelletMap(): PelletMap {
  const map: PelletMap = [];
  for (let r = 0; r < MAZE.length; r += 1) {
    const row: boolean[] = [];
    const src = MAZE[r];
    for (let c = 0; c < COLS; c += 1) {
      const ch = src[c];
      row.push(ch === "." || ch === "o");
    }
    map.push(row);
  }
  return map;
}

/** Initial Pac state — sitting on the spawn tile, not moving yet. */
export function initialPac(): PacState {
  return {
    x: SPAWN_X,
    y: SPAWN_Y,
    dir: "none",
    queued: "none",
  };
}

/** Is (col, row) walkable? Walls and the ghost-house door block Pac.
 *  Out-of-bounds is treated as walkable on the tunnel row (so we can
 *  detect the wrap), wall everywhere else. */
function isWalkable(col: number, row: number): boolean {
  // Tunnel row: off-edge columns are conceptually walkable — wrap handled
  // by the caller.
  if (row === 14 && (col < 0 || col >= COLS)) return true;
  if (row < 0 || row >= MAZE.length) return false;
  if (col < 0 || col >= COLS) return false;
  const ch = MAZE[row][col];
  return ch !== "#" && ch !== "-";
}

function step(col: number, row: number, dir: Direction): { x: number; y: number } {
  switch (dir) {
    case "left":
      return { x: col - 1, y: row };
    case "right":
      return { x: col + 1, y: row };
    case "up":
      return { x: col, y: row - 1 };
    case "down":
      return { x: col, y: row + 1 };
    case "none":
      return { x: col, y: row };
  }
}

/** Apply tunnel wrap on row 14. Returns the same coords for any other row. */
function wrap(x: number, y: number): { x: number; y: number } {
  if (y !== 14) return { x, y };
  if (x < 0) return { x: COLS - 1, y };
  if (x >= COLS) return { x: 0, y };
  return { x, y };
}

/** One tick of Pac motion. Mutates `state.pac`, `state.pelletMap`,
 *  `state.pellets`, `state.score`. The engine calls this from `update()`. */
export function tickPac(state: GameState): void {
  const pac = state.pac;

  // 1. Try to honor the queued direction at the current tile. If the
  //    neighbor in that direction is walkable, commit the turn — the
  //    "pre-turn at a corner" responsiveness.
  if (pac.queued !== "none" && pac.queued !== pac.dir) {
    const target = step(pac.x, pac.y, pac.queued);
    const wrapped = wrap(target.x, target.y);
    if (isWalkable(wrapped.x, wrapped.y)) {
      pac.dir = pac.queued;
      pac.queued = "none";
    }
  }

  // 2. If we have an active direction, attempt the move. Tile-aligned
  //    only — we step exactly one tile per (1 / SPEED_PER_TICK) ticks
  //    by accumulating progress, but to keep the harness simple and the
  //    state field count tight we move one whole tile when progress
  //    overflows. Track progress on the pac object via a non-enumerable
  //    field would complicate types — instead, derive ticks-per-tile.
  if (pac.dir === "none") return;

  // Progress lives on a closure-local cache keyed off the engine tick.
  // To avoid adding fields to the public PacState (and breaking the test
  // contract surface), we attach it as an internal property.
  const internal = pac as PacState & { _progress?: number };
  const prog = (internal._progress ?? 0) + SPEED_PER_TICK;

  if (prog < 1) {
    internal._progress = prog;
    return;
  }

  // 3. Commit one tile of movement.
  const target = step(pac.x, pac.y, pac.dir);
  const wrapped = wrap(target.x, target.y);

  if (!isWalkable(wrapped.x, wrapped.y)) {
    // Wall in front: stop at tile center, wait for a viable queued dir.
    internal._progress = 0;
    pac.dir = "none";
    return;
  }

  pac.x = wrapped.x;
  pac.y = wrapped.y;
  internal._progress = prog - 1;

  // 4. Eat pellet if one lives on this tile.
  const row = state.pelletMap[pac.y];
  if (row && row[pac.x]) {
    row[pac.x] = false;
    state.pellets -= 1;
    state.score += 10;
  }
}

/** Test/debug helper: set the queued direction. */
export function queueDirection(state: GameState, dir: Direction): void {
  state.pac.queued = dir;
}
