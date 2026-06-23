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
   *  Issue #183 — extended to `'white'` for the level-clear opening veil
   *  (the held beat before the maze starts pulsing). Reset to `'cyan'`
   *  at the end of the death-anim / clear-anim window. */
  flashTint: "cyan" | "red" | "white";
  /** Issue #183 — Pac level-clear cinematic phase. Counts UP from 0
   *  while the maze-flash + bonus-tally sequence plays. Set to 1 on
   *  eating the final pellet; engine gates the whole sim while >0;
   *  renderer reads it to drive the maze flash cycles and the bonus
   *  tally HUD. When it reaches CLEAR_ANIM_TICKS the existing level-up
   *  reset path (handleLevelWon body) finally fires. */
  clearTicks: number;
  /** Issue #183 — current count-up value of the level-clear bonus
   *  shown in the tally HUD. Purely cosmetic — the actual score bump
   *  lands in one atomic write at tick CLEAR_FLASH_END, so the live
   *  `state.score` is authoritative. Reset to 0 at the end of the
   *  clear-anim window. */
  clearTallyShown: number;
}

/** Issue #210 — input-to-direction-commit latency probe shape. Returned
 *  from `window.__pacInternals.dirCommitProbe()`. The probe reports the
 *  per-tick gap between the most recent input event (`pac.queued`
 *  written) and the most recent tick on which `tickPac` honored a
 *  queued press and flipped `pac.dir`.
 *
 *  - `lastQueuedTick`: the tick on which the next `update()` would see
 *    the queued direction (i.e. `state.tick + 1` at the moment of the
 *    input event). -1 means no input has fired yet.
 *  - `lastCommitTick`: the tick on which `tickPac` last committed a
 *    queued direction. -1 until the first commit.
 *  - `deltaTicks`: `lastCommitTick - lastQueuedTick` when both stamps
 *    are present; `null` when either stamp is unset. Negative reads
 *    (a press that arrived AFTER the most recent commit but before any
 *    new commit can fire) are also reported as `null` — the spec uses
 *    `null` as the "no measurement yet" signal and filters accordingly. */
export interface DirCommitProbe {
  lastQueuedTick: number;
  lastCommitTick: number;
  deltaTicks: number | null;
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

/** Issue #183 — total ticks of the Pac level-clear cinematic. 84 ticks ≈
 *  1400ms at the engine's 60Hz step. Slightly longer than the death
 *  cinematic (#171: 72 ticks) — winning earns the longer beat. Broken
 *  into pre-pause (0..11) / maze-flash (12..59) / bonus-tally (60..83).
 *  Exported so the renderer + tests can read the same constants the
 *  engine writes. */
export const CLEAR_ANIM_TICKS = 84;
/** End-exclusive: ticks [0, CLEAR_PRE_PAUSE) hold the last frame — Pac
 *  frozen at the final pellet position, ghosts frozen in place — for
 *  the "I did it" beat before the maze flash starts. Renderer still
 *  draws Pac + ghosts during this window. */
export const CLEAR_PRE_PAUSE = 12;
/** End-exclusive: ticks [CLEAR_PRE_PAUSE, CLEAR_FLASH_END) drive the
 *  blue→white maze-flash. 48 ticks = 4 cycles of 12 ticks each. During
 *  this window the renderer SKIPS drawing Pac and the ghost roster —
 *  the empty pulsing maze IS the celebration. */
export const CLEAR_FLASH_END = 60;
/** End-exclusive: ticks [CLEAR_FLASH_END, CLEAR_TALLY_END) drive the
 *  bonus-tally count-up. After this, CLEAR_ANIM_TICKS triggers the
 *  level-up reset path (maze refills, ghosts respawn, level += 1). */
export const CLEAR_TALLY_END = 84;
/** Issue #183 — score bonus added to `state.score` on level clear, in
 *  one atomic write at the boundary tick CLEAR_FLASH_END. The displayed
 *  `clearTallyShown` is a cosmetic count-up toward this value over the
 *  tally window. Starting value chosen to read as a meaningful payoff
 *  without dominating the per-pellet scoring economy. */
export const LEVEL_CLEAR_BONUS = 1000;

/** Issue #295 — arcade canon's one celebratory threshold. Pac-Man awards
 *  a free life at 10,000 points: the single moment in a game otherwise
 *  about loss where the maze gives instead of takes. One-shot — does
 *  not re-fire on subsequent levels. */
export const EXTRA_LIFE_SCORE = 10000;
/** Issue #295 — banner hold duration after the threshold is crossed.
 *  90 ticks ≈ 1.5s at 60Hz: the arcade's "you earned this, look at it"
 *  beat. Reuses the READY!/GAME OVER status-overlay slot. */
export const EXTRA_BANNER_TICKS = 90;

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
  /** Issue #295 — one-shot latch for the 10,000-point extra-life
   *  threshold. Boots false; flips true the tick `score` crosses from
   *  `< EXTRA_LIFE_SCORE` to `>= EXTRA_LIFE_SCORE`. Never resets during
   *  play — arcade canon awards the free life exactly once per game,
   *  not per level. (Reset only via `initialState()` on a new game.) */
  extraLifeAwarded: boolean;
  /** Issue #295 — remaining ticks of the EXTRA banner overlay. Set to
   *  `EXTRA_BANNER_TICKS` (90 ≈ 1.5s) the tick the threshold is crossed;
   *  decrements once per `update()`. Renderer paints the EXTRA string
   *  in the existing READY!/GAME OVER slot while > 0. */
  extraLifeBanner: number;
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
      clearTicks: 0,
      clearTallyShown: 0,
    },
    extraLifeAwarded: false,
    extraLifeBanner: 0,
  };
}
