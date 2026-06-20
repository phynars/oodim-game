// The state contract (load-bearing). `window.__pac` mirrors `GameState`, and
// e2e/pacman.spec.ts asserts on it — that's how we verify the game *plays*,
// not just compiles. Add fields as mechanics land; never remove a field a
// test depends on.

import { COLS, ROWS, countPellets } from "./maze";
import type { GhostState } from "./ghost";

export type GameStatus =
  | "ready"
  | "playing"
  | "paused"
  | "won"
  | "lost"
  | "gameover";

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

/** Issue #138 — pellet-pickup juice channel. Pure data on GameState:
 *  the engine writes it on the eat-event + decays it each tick, the
 *  renderer reads it. Mirrors the Galaga shape (#133) so cross-game
 *  feedback handling stays consistent. Pac-Man intentionally omits
 *  screen-shake (graceful, not punchy). */
export interface FeedbackChannel {
  /** Brief scale-pop on Pac when a pellet lands. Renderer multiplies
   *  Pac's draw radius by (1 + amp). Decays toward 0 each tick. */
  pacSquash: number;
  /** Floating score popups: "+10" / "+50". Rises and fades. */
  popups: Array<{ x: number; y: number; value: number; ageTicks: number }>;
  /** Screen flash for power-pellet activation only. Renderer overlays
   *  a translucent white rect at this alpha; decays. */
  flashAlpha: number;
  /** Pellet-vanish bursts: small sparkles at the eaten tile, drifting
   *  outward then fading. */
  sparkles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    ageTicks: number;
  }>;
  /** Issue #150 — remaining hitstop ticks. While >0, the engine SKIPS
   *  its per-tick simulation update (ghosts + Pac frozen). Renderer
   *  still draws; decay still runs. Mirrors galaga's hitstop semantics.
   *  Written via `Math.max` so an unlikely double-eat-this-tick doesn't
   *  accumulate hitstop and freeze the engine. Decays by 1/tick in
   *  the gate at the top of update(). */
  hitstopTicks: number;
  /** Issue #171 — Pac death-animation phase. Counts UP from 0 while
   *  the spin-collapse cinematic plays. Set to 1 on fatal collision
   *  (after a brief hitstop "impact"); engine gates the whole sim
   *  while >0; renderer reads it to drive the wedge-opens-then-shrinks
   *  curve. When it reaches DEATH_ANIM_TICKS the existing reset path
   *  (lives--, respawn, lost-check) finally fires. */
  deathTicks: number;
  /** Issue #171 — colour override for the screen-flash veil. `'cyan'`
   *  (default) keeps the power-pellet activation veil unchanged; `'red'`
   *  tints the brief "impact" flash that lands on a fatal ghost touch.
   *  Reset to `'cyan'` at the end of the death-anim window. */
  flashTint: "cyan" | "red";
}

/** Issue #171 — total ticks of the Pac death cinematic. 72 ticks ≈ 1200ms
 *  at the engine's 60Hz step. Broken into pre-pause (0..11) / collapse
 *  (12..59) / post-pause (60..71). Exported so the renderer + tests can
 *  read the same constants the engine writes. */
export const DEATH_ANIM_TICKS = 72;
/** End-exclusive: ticks [0, DEATH_PRE_PAUSE) hold the last frame — Pac
 *  and ghosts frozen — for the "oh no" beat before the collapse starts. */
export const DEATH_PRE_PAUSE = 12;
/** End-exclusive: ticks [DEATH_PRE_PAUSE, DEATH_COLLAPSE_END) drive the
 *  mouth-open-then-shrink animation. After this, the post-pause holds a
 *  blank frame until DEATH_ANIM_TICKS triggers the reset. */
export const DEATH_COLLAPSE_END = 60;

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
  /** Public ghost roster. Slim views (name/x/y/mode) — internal AI state
   *  is held privately by the engine. The e2e contract reads this. */
  ghosts: GhostState[];
  /** Render-feedback channel (issue #138). Written by tickPac/engine,
   *  read by the renderer. Pure data — no DOM, no callbacks. */
  feedback: FeedbackChannel;
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
    ghosts: [],
    feedback: {
      pacSquash: 0,
      popups: [],
      flashAlpha: 0,
      sparkles: [],
      hitstopTicks: 0,
      deathTicks: 0,
      flashTint: "cyan",
    },
  };
}
