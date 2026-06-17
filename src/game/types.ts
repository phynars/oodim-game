// The state contract (load-bearing). `window.__pac` mirrors `GameState`, and
// e2e/pacman.spec.ts asserts on it — that's how we verify the game *plays*,
// not just compiles. Add fields as mechanics land; never remove a field a
// test depends on.

import { COLS, ROWS, countPellets } from "./maze";

export type GameStatus = "ready" | "playing" | "paused" | "gameover";

/** Cardinal direction, plus a 'none' rest state for a stopped Pac. */
export type Direction = "none" | "up" | "down" | "left" | "right";

/** Pac-Man's published state. Tile coords — sub-tile glide progress is
 *  internal and intentionally not part of the test contract. */
export interface PacState {
  /** Tile column (0..COLS-1). */
  x: number;
  /** Tile row (0..ROWS-1). */
  y: number;
  /** Direction currently moving in. 'none' = at rest. */
  dir: Direction;
  /** Direction the player most recently requested. Applied at the next
   *  tile boundary if walkable. */
  queued: Direction;
}

export interface GameState {
  /** High-level lifecycle. Boots to 'ready'. */
  status: GameStatus;
  /** Fixed-timestep update counter. Increments once per `update()` call. */
  tick: number;
  /** Player score. */
  score: number;
  /** Lives remaining. Starts at 3. */
  lives: number;
  /** Remaining pellets on the board. Seeded from the static maze layout;
   *  decremented as pellets are eaten. */
  pellets: number;
  /** Static maze dimensions. Published so tests + HUD code can read the
   *  grid shape without importing the maze module. */
  maze: { cols: number; rows: number };
  /** The player. Spawned at the start tile; mutated by tickPac. */
  pac: PacState;
  /** Mutable mirror of which tiles still hold food. [row][col] → present.
   *  Owned by the engine; read by the renderer; mutated by tickPac. */
  pelletMap: boolean[][];
}

declare global {
  interface Window {
    /** Test contract. See docs/ARCHITECTURE.md. */
    __pac?: GameState;
  }
}

/** Canonical initial state. Engine seeds `__pac` from this on construction. */
export function initialState(): GameState {
  // Lazy import to avoid a circular module load: pacman imports types.
  // We rebuild the pellet map and pac inline here, mirroring what
  // pacman.ts exports — but pacman.ts depends on types, so we inline
  // the trivial defaults and let the engine wire the richer helpers.
  return {
    status: "ready",
    tick: 0,
    score: 0,
    lives: 3,
    pellets: countPellets(),
    maze: { cols: COLS, rows: ROWS },
    pac: { x: 13, y: 23, dir: "none", queued: "none" },
    pelletMap: [],
  };
}
