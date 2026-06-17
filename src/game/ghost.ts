// Blinky — the red ghost. First slice of ghost AI.
//
// Movement model:
// - Tile-based. At each tile boundary, Blinky looks at the four neighbors,
//   excludes the tile he just came from (no reversing), and picks the
//   walkable neighbor whose squared distance to the current target tile
//   is smallest. Classic Pac AI — deterministic, no path-finding.
// - A mode timer alternates SCATTER ↔ CHASE on a fixed cadence. In
//   scatter Blinky targets a fixed corner; in chase he targets Pac's
//   current tile. The arcade uses a longer, irregular schedule; we use
//   a single steady period so the e2e can deterministically observe a
//   transition inside its polling window.
//
// Speed: one tile per (1 / SPEED_PER_TICK) ticks, mirroring Pac's
// sub-tile glide so the ghost moves at a comparable rate.

import { COLS, MAZE, ROWS } from "./maze";
import type { GameState } from "./types";

export type GhostMode = "scatter" | "chase";

/** Public ghost state — mirrored onto `window.__pac.ghosts`. Keep this
 *  small; the e2e contract only needs name, tile coords, and mode. */
export interface GhostState {
  name: string;
  /** Tile column. */
  x: number;
  /** Tile row. */
  y: number;
  mode: GhostMode;
}

/** Internal ghost — adds the bits the AI needs but the test contract
 *  doesn't care about. The engine stores these; we publish the slim
 *  GhostState shape onto the state. */
export interface GhostInternal extends GhostState {
  /** Direction last moved in, used to forbid 180° reversals. */
  lastDir: Dir;
  /** Sub-tile glide progress, 0..1. Same trick Pac uses. */
  _progress: number;
}

type Dir = "up" | "down" | "left" | "right";
const DIRS: readonly Dir[] = ["up", "down", "left", "right"] as const;

/** Tiles per tick. Slightly slower than Pac (0.12) so chase tension
 *  builds without being immediately lethal. */
const GHOST_SPEED_PER_TICK = 0.10;

/** Mode period, in ticks. 60 ticks/s × 5s = 300 ticks per phase. The
 *  e2e waits up to ~6s after boot, so a transition is guaranteed inside
 *  the polling window. Boots in scatter (matches arcade). */
export const MODE_PERIOD_TICKS = 300;

/** Blinky's scatter target: top-right corner, just outside the maze
 *  proper. Arcade-canonical. */
const BLINKY_SCATTER: { x: number; y: number } = { x: COLS - 2, y: 0 };

/** Blinky's spawn tile. Top of the ghost-house — the spot Blinky leaves
 *  from in the arcade. Row 11 column 13/14 is the open lip above the
 *  house; we pick (13, 11) which is the empty cell just inside. */
const BLINKY_SPAWN: { x: number; y: number } = { x: 13, y: 11 };

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

/** Build the initial Blinky. Engine calls this once at construction. */
export function spawnBlinky(): GhostInternal {
  return {
    name: "blinky",
    x: BLINKY_SPAWN.x,
    y: BLINKY_SPAWN.y,
    mode: "scatter",
    lastDir: "left",
    _progress: 0,
  };
}

/** Decide Blinky's current target tile from mode + Pac position. */
function targetFor(g: GhostInternal, state: GameState): { x: number; y: number } {
  if (g.mode === "chase") {
    return { x: state.pac.x, y: state.pac.y };
  }
  return BLINKY_SCATTER;
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

/** One tick of ghost AI. Mutates the ghost in place; updates mode based
 *  on the engine tick. Publishes a slim view onto state.ghosts. */
export function tickGhost(g: GhostInternal, state: GameState): void {
  // 1. Mode timer. Period-based flip; deterministic w.r.t. tick.
  //    tick 0..MODE_PERIOD-1 → scatter, MODE_PERIOD..2*MODE_PERIOD-1 →
  //    chase, and so on.
  const phase = Math.floor(state.tick / MODE_PERIOD_TICKS) % 2;
  g.mode = phase === 0 ? "scatter" : "chase";

  // 2. Advance sub-tile progress.
  g._progress += GHOST_SPEED_PER_TICK;
  if (g._progress < 1) return;
  g._progress -= 1;

  // 3. At the tile boundary, choose a direction and move one tile.
  const target = targetFor(g, state);
  const dir = pickDirection(g, target);
  const s = step(g.x, g.y, dir);
  const next = wrap(s.x, s.y);
  // pickDirection only returns walkable neighbors except the fully-boxed-in
  // edge case; guard once more for safety.
  if (!isWalkableForGhost(next.x, next.y)) {
    g._progress = 0;
    return;
  }
  g.x = next.x;
  g.y = next.y;
  g.lastDir = dir;
}

/** Strip a GhostInternal down to the public contract shape. */
export function publicGhostView(g: GhostInternal): GhostState {
  return { name: g.name, x: g.x, y: g.y, mode: g.mode };
}
