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

/** Issue #296 — power-pellet pickup is the ceremonial RULE-INVERSION
 *  beat (all four ghosts flip predator→prey). The juice spec is
 *  graceful, not violent: tone-adapted per the issue.
 *
 *  PULSE_TICKS: count-down counter armed on the eat. Renderer derives
 *  `progress = 1 - n/PULSE_TICKS` for the maze tint cycle + Pac stat-pop.
 *  18 ticks ≈ 300ms at 60Hz.
 *
 *  SHAKE_AMP: peak screen-shake amplitude in CSS pixels. Decays
 *  ×0.85/tick at a phase of ~1.9Hz. 1.2px is small — Pac-Man is GRACEFUL
 *  (compare to Galaga's larger amplitudes). Falls below the visible
 *  floor (0.01) around tick 14.
 *
 *  HITSTOP_TICKS: 4 frames ≈ 67ms — between Pac death (#171 = 4f) and
 *  Galaga clear (6f). The CEREMONIAL weight comes from this + the maze
 *  tint pulse, not from violent shake.
 *
 *  POPUP_VALUE: the score-pop label written at Pac position on pickup.
 *  Matches canon score for a power pellet (50).
 *
 *  PAC_POP_PEAK: peak Pac stat-pop scale on the eat: `1 + 0.22` = 1.22×.
 *  Linear ramp to peak over PAC_POP_RAMP ticks (5), then exp decay over
 *  the remaining (PULSE_TICKS - PAC_POP_RAMP) = 13 ticks. Layered
 *  ADDITIVELY on top of #138's existing squash via `Math.max` so the
 *  regular-pellet squash channel isn't downgraded. */
export const POWER_PELLET_PULSE_TICKS = 18;
export const POWER_PELLET_SHAKE_AMP = 1.2;
export const POWER_PELLET_HITSTOP_TICKS = 4;
export const POWER_PELLET_POPUP_VALUE = 50;
export const POWER_PELLET_PAC_POP_PEAK = 0.22;
export const POWER_PELLET_PAC_POP_RAMP = 5;

/** Issue #138 — pellet-pickup juice channel. Pure data on GameState:
 *  the engine writes it on the eat-event + decays it each tick, the
 *  renderer reads it. Mirrors the Galaga shape (#133) so cross-game
 *  feedback handling stays consistent. Pac-Man intentionally omits
 *  screen-shake (graceful, not punchy) — EXCEPT for the power-pellet
 *  ceremonial beat (#296), which arms a small bounded shake. */
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
  /** Issue #296 — power-pellet ceremonial pulse counter. Counts DOWN
   *  from POWER_PELLET_PULSE_TICKS (18) to 0; renderer reads
   *  `1 - n/N` as maze-tint progress so walls flash white→base over
   *  ~300ms. Only the atePowerPellet branch arms this. */
  powerPelletPulse: number;
  /** Issue #296 — power-pellet screen-shake magnitude (px). Armed to
   *  POWER_PELLET_SHAKE_AMP (1.2); decays ×0.85/tick. Small on purpose
   *  — Pac-Man is GRACEFUL; ceremonial weight comes from the maze
   *  tint + hitstop, not from violence. */
  powerPelletShake: number;
  /** Issue #183 — current count-up value of the level-clear bonus
   *  shown in the tally HUD. Purely cosmetic — the actual score bump
   *  lands in one atomic write at tick CLEAR_FLASH_END, so the live
   *  `state.score` is authoritative. Reset to 0 at the end of the
   *  clear-anim window. */
  clearTallyShown: number;
  /** Issue #296 — power-pellet pickup pulse. Count-down counter armed
   *  to POWER_PELLET_PULSE_TICKS on the eat; decrements once per
   *  `update()` (only while NOT in hitstop / death / clear gates).
   *  Renderer derives progress = (PULSE_TICKS - n) / PULSE_TICKS and
   *  uses it for: (a) maze wall tint toward white during the pulse
   *  window, (b) Pac stat-pop linear-ramp-then-settle. Decay shape is
   *  linear (-1/tick) since the renderer drives the curve. Floor 0. */
  powerPelletPulse: number;
  /** Issue #296 — power-pellet ceremonial screen-shake amplitude in
   *  CSS pixels. Armed to POWER_PELLET_SHAKE_AMP on the eat; decays
   *  ×0.85/tick (only while NOT in hitstop / death / clear gates) until
   *  it falls below 0.01, then floored to 0. Renderer translates the
   *  whole canvas by `(amp * cos(phase), amp * sin(phase))` for one
   *  rendered frame — phase advances at 1.9Hz off `state.tick`. */
  powerPelletShake: number;
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
/** Issue #296 — power-pellet ceremonial pulse window. 18 ticks ≈
 *  300ms at 60Hz. Renderer reads `1 - n/N` as the tint progress. */
export const POWER_PELLET_PULSE_TICKS = 18;
/** Issue #296 — power-pellet hitstop window. 4 frames ≈ 67ms at 60Hz. */
export const POWER_PELLET_HITSTOP_TICKS = 4;
/** Issue #296 — power-pellet starting shake amplitude (px). Small on
 *  purpose: 1.2px vs Galaga's 4px — graceful, not punchy. */
export const POWER_PELLET_SHAKE_AMP = 1.2;
/** Issue #296 — per-tick shake decay. ×0.85 brings 1.2 to <0.1 by ~16t. */
export const POWER_PELLET_SHAKE_DECAY = 0.85;
/** Issue #296 — Pac stat-pop amplitude on power-pellet eat. With the
 *  existing pacSquash ×0.78/tick decay, 0.22 → <0.01 by tick 17. */
export const POWER_PELLET_SQUASH_AMP = 0.22;
/** Issue #296 — score popup value on power-pellet eat. Receipt only;
 *  the authoritative score bump still lands in tickPac. */
export const POWER_PELLET_POPUP_VALUE = 50;
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

/** Issue #305 — arcade canon's mid-level give-to-player beat. The fruit
 *  appears in the slot under the ghost house at two dot-count thresholds
 *  per level (70 dots eaten, 170 dots eaten), lingers for a window, then
 *  vanishes. Eating it pops the canon score for the current level. The
 *  ONLY mid-level give in a game otherwise about take.
 *
 *  Companion to #295 (EXTRA at 10k). Together they restore the full
 *  give-to-player vocabulary the canon assumes. */
export const FRUIT_FIRST_DOTS = 70;
export const FRUIT_SECOND_DOTS = 170;
/** Fruit on-screen window: ~120 ticks ≈ 2s at 60Hz. The sprite IS the
 *  timer — no separate countdown UI. */
export const FRUIT_LIFETIME_TICKS = 120;
/** Fruit spawn tile — under the ghost house, on the open corridor row
 *  between the house door and Pac's spawn. Single canonical tile;
 *  player walks onto it to claim the score. */
export const FRUIT_SPAWN_X = 13;
export const FRUIT_SPAWN_Y = 17;
/** Per-level canon fruit score table. Level 1 → 100 (cherry), level 2 →
 *  300 (strawberry), then 500/700/1000/2000/3000/5000 — arcade values.
 *  Beyond level 8 holds at 5000 (canon "key" plateau). The sprite/skin
 *  is implicit in the level; the player-facing word stays FRUIT either
 *  way (per the rejected-options table in #305). */
export const FRUIT_SCORES: ReadonlyArray<number> = [
  100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000,
];
/** Fruit kind for a given 1-indexed level — cosmetic only (the banner
 *  word is always `FRUIT`). Clamped to the final tier. */
export type FruitKind =
  | "cherry"
  | "strawberry"
  | "orange"
  | "apple"
  | "melon"
  | "galaxian"
  | "bell"
  | "key";
export const FRUIT_KINDS: ReadonlyArray<FruitKind> = [
  "cherry",
  "strawberry",
  "orange",
  "orange",
  "apple",
  "apple",
  "melon",
  "melon",
  "galaxian",
  "galaxian",
  "bell",
  "bell",
  "key",
];
/** Banner hold duration after fruit spawns. Matches the on-screen window
 *  so the word and the sprite share a heartbeat. Reuses the
 *  READY!/EXTRA/GAME OVER status-overlay slot. */
export const FRUIT_BANNER_TICKS = FRUIT_LIFETIME_TICKS;

/** Issue #305 — the four canon banner strings, exported so a future
 *  taste-pass updates one place. Loss has many words; reward has one.
 *  All four ride the same yellow status-overlay slot in render. */
export const BANNER_READY = "READY!";
export const BANNER_EXTRA = "EXTRA";
export const BANNER_FRUIT = "FRUIT";
export const BANNER_GAME_OVER = "GAME OVER";

/** Issue #305 — fruit state on the board. `null` when no fruit is active;
 *  populated when the dot-count threshold trips. The sprite IS the timer:
 *  `ticksRemaining` counts down each `update()`; at 0 the fruit disarms
 *  (back to `null`) without any banner-of-vanish. Eating disarms early
 *  via the same `null` write, plus a score-pop popup (no banner-of-eat). */
export interface FruitState {
  /** Tile column (always FRUIT_SPAWN_X in this slice). */
  x: number;
  /** Tile row (always FRUIT_SPAWN_Y in this slice). */
  y: number;
  /** Cosmetic sprite identity for this level. Banner word stays FRUIT. */
  kind: FruitKind;
  /** Canon score the player claims by walking onto the fruit tile. */
  value: number;
  /** Ticks remaining until auto-disarm. Decrements once per `update()`. */
  ticksRemaining: number;
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
  /** Issue #305 — total pellets eaten this level. Increments on every
   *  pellet / power-pellet eat in tickPac. Drives the two canon fruit
   *  spawn thresholds (FRUIT_FIRST_DOTS = 70, FRUIT_SECOND_DOTS = 170).
   *  Resets to 0 in handleLevelWon() — each level gets its own pair of
   *  fruit appearances, per arcade canon. */
  dotsEaten: number;
  /** Issue #305 — how many fruit spawns have already armed THIS level
   *  (0, 1, or 2). Prevents a re-trip if the player crosses the same
   *  threshold backwards somehow, and gates the second spawn so it
   *  fires exactly once. Resets to 0 in handleLevelWon(). */
  fruitSpawnsThisLevel: number;
  /** Issue #305 — active fruit on the board, or `null` if none. The
   *  sprite IS the timer: `ticksRemaining` counts down; renderer reads
   *  it to draw the sprite + the FRUIT banner; engine clears to `null`
   *  on player overlap (with a score pop) OR on ticksRemaining === 0. */
  fruit: FruitState | null;
  /** Issue #305 — remaining ticks of the FRUIT banner overlay. Set to
   *  `FRUIT_BANNER_TICKS` (120 ≈ 2s) the tick fruit arms; decrements
   *  once per `update()`. Renderer paints `FRUIT` in the existing
   *  READY!/EXTRA/GAME OVER slot while > 0. Note this can outlive the
   *  fruit itself by zero ticks (we tie them to the same window) — and
   *  in the eat case the banner ALSO clears immediately, because the
   *  score-pop is the new player-facing signal, not the word. */
  fruitBanner: number;
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
      powerPelletPulse: 0,
      powerPelletShake: 0,
      powerPelletPulse: 0,
      powerPelletShake: 0,
    },
    extraLifeAwarded: false,
    extraLifeBanner: 0,
    dotsEaten: 0,
    fruitSpawnsThisLevel: 0,
    fruit: null,
    fruitBanner: 0,
  };
}
