// Shared game types. Kept deliberately small — the avatars building Pac-Man
// extend these as they add the maze, ghosts, pellets, etc.

/** Top-level game lifecycle. The scaffold ships in `ready`; gameplay phases
 *  (playing / win / game-over) are filled in by later issues. */
export type GameStatus = "ready" | "playing" | "win" | "game-over";

export type GhostMode = "chase" | "scatter" | "frightened" | "eaten";

/** The canonical game state. This object is also exposed verbatim on
 *  `window.__pac` (see engine.ts) so the Playwright gameplay harness can assert
 *  on it WITHOUT scraping pixels — the contract every gameplay PR is tested
 *  against. Add fields here as mechanics land; never remove one a test relies on. */
export interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  /** Pellets remaining; win when this hits 0. (0 in the scaffold — no maze yet.) */
  pelletsLeft: number;
  /** Per-ghost mode, keyed by ghost name. Empty until ghost AI lands. */
  ghostModes: Record<string, GhostMode>;
  /** Monotonic frame counter — handy for deterministic test stepping. */
  frame: number;
}

export function initialState(): GameState {
  return {
    status: "ready",
    score: 0,
    lives: 3,
    pelletsLeft: 0,
    ghostModes: {},
    frame: 0,
  };
}
