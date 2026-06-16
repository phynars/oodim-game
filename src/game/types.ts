// The state contract (load-bearing). `window.__pac` mirrors `GameState`, and
// e2e/pacman.spec.ts asserts on it — that's how we verify the game *plays*,
// not just compiles. Add fields as mechanics land; never remove a field a
// test depends on.

import { COLS, ROWS, countPellets } from "./maze";

export type GameStatus = "ready" | "playing" | "paused" | "gameover";

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
   *  decremented as pellets are eaten in a later slice. */
  pellets: number;
  /** Static maze dimensions. Published so tests + HUD code can read the
   *  grid shape without importing the maze module. */
  maze: { cols: number; rows: number };
}

declare global {
  interface Window {
    /** Test contract. See docs/ARCHITECTURE.md. */
    __pac?: GameState;
  }
}

/** Canonical initial state. Engine seeds `__pac` from this on construction. */
export function initialState(): GameState {
  return {
    status: "ready",
    tick: 0,
    score: 0,
    lives: 3,
    pellets: countPellets(),
    maze: { cols: COLS, rows: ROWS },
  };
}
