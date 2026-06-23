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
import {
  EXTRA_BANNER_TICKS,
  EXTRA_LIFE_SCORE,
  FRUIT_BANNER_TICKS,
  FRUIT_FIRST_DOTS,
  FRUIT_KINDS,
  FRUIT_LIFETIME_TICKS,
  FRUIT_SCORES,
  FRUIT_SECOND_DOTS,
  FRUIT_SPAWN_X,
  FRUIT_SPAWN_Y,
  type Direction,
  type GameState,
  type PacState,
} from "./types";

/** Tiles per tick. 60 ticks/sec * 0.12 ≈ 7.2 tiles/sec — feels close to
 *  arcade Pac (which is ~75 tiles/sec at the original scale, then visually
 *  much slower because tiles are larger here). Tunable. */
const SPEED_PER_TICK = 0.12;

/** Classic-ish spawn: row 23, in the open gap left of center. From here
 *  the very next tile right is a pellet, which is what the e2e relies on.
 *  Exported so the collision-reset path can snap Pac back to start. */
export const SPAWN_X = 13;
export const SPAWN_Y = 23;

/** Reset Pac to spawn — used by the engine after a fatal ghost collision.
 *  Clears direction + queued input + internal glide progress so the next
 *  tick starts cleanly. Does NOT touch lives or score. */
export function resetPacToSpawn(state: GameState): void {
  const pac = state.pac as PacState & { _progress?: number };
  pac.x = SPAWN_X;
  pac.y = SPAWN_Y;
  pac.dir = "none";
  pac.queued = "none";
  pac._progress = 0;
}

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

/** Result of one Pac tick — surfaces events the engine needs to react to.
 *  - `atePowerPellet`: arm frightened mode (regular pellets are
 *    fully self-contained inside tickPac).
 *  - `committedQueued` (issue #210): step-1 honored a pending `pac.queued`
 *    and flipped `pac.dir`. The engine uses this signal to stamp
 *    `lastCommitTick` on the input-to-direction-commit probe without
 *    re-deriving the transition from the public state. */
export interface PacTickResult {
  atePowerPellet: boolean;
  committedQueued: boolean;
}

/** One tick of Pac motion. Mutates `state.pac`, `state.pelletMap`,
 *  `state.pellets`, `state.score`. The engine calls this from `update()`. */
export function tickPac(state: GameState): PacTickResult {
  const pac = state.pac;

  // Default result; flipped below if a power pellet is eaten this tick,
  // or if step-1 honored a pending queued direction.
  const result: PacTickResult = {
    atePowerPellet: false,
    committedQueued: false,
  };

  // 1. Try to honor the queued direction at the current tile. If the
  //    neighbor in that direction is walkable, commit the turn — the
  //    "pre-turn at a corner" responsiveness.
  if (pac.queued !== "none" && pac.queued !== pac.dir) {
    const target = step(pac.x, pac.y, pac.queued);
    const wrapped = wrap(target.x, target.y);
    if (isWalkable(wrapped.x, wrapped.y)) {
      pac.dir = pac.queued;
      pac.queued = "none";
      // Issue #210 — surface the commit event so the engine can stamp
      // `lastCommitTick` for the dir-commit-latency probe.
      result.committedQueued = true;
    }
  }

  // 2. If we have an active direction, attempt the move. Tile-aligned
  //    only — we step exactly one tile per (1 / SPEED_PER_TICK) ticks
  //    by accumulating progress, but to keep the harness simple and the
  //    state field count tight we move one whole tile when progress
  //    overflows. Track progress on the pac object via a non-enumerable
  //    field would complicate types — instead, derive ticks-per-tile.
  if (pac.dir === "none") return result;

  // Progress lives on a closure-local cache keyed off the engine tick.
  // To avoid adding fields to the public PacState (and breaking the test
  // contract surface), we attach it as an internal property.
  const internal = pac as PacState & { _progress?: number };
  const prog = (internal._progress ?? 0) + SPEED_PER_TICK;

  if (prog < 1) {
    internal._progress = prog;
    return result;
  }

  // 3. Commit one tile of movement.
  const target = step(pac.x, pac.y, pac.dir);
  const wrapped = wrap(target.x, target.y);

  if (!isWalkable(wrapped.x, wrapped.y)) {
    // Wall in front: stop at tile center, wait for a viable queued dir.
    internal._progress = 0;
    pac.dir = "none";
    return result;
  }

  pac.x = wrapped.x;
  pac.y = wrapped.y;
  internal._progress = prog - 1;

  // 4a. Issue #305 — fruit pickup on tile overlap. Check BEFORE the
  //     pellet eat so the spawn tile (which has no pellet) still
  //     resolves correctly when fruit and Pac coincide. The score-pop
  //     popup IS the player-facing signal — no banner-of-eat. The
  //     `FRUIT` banner clears immediately (the canon give-beat ends
  //     when the player claims it; the maze speaks via score now).
  if (state.fruit && pac.x === state.fruit.x && pac.y === state.fruit.y) {
    const value = state.fruit.value;
    const scoreBeforeFruit = state.score;
    state.score += value;
    // Score popup at the fruit tile — same 24-tick lifetime as pellets.
    state.feedback.popups.push({
      x: pac.x,
      y: pac.y,
      value,
      ageTicks: 0,
    });
    state.fruit = null;
    state.fruitBanner = 0;
    // Fruit score can cross the 10k extra-life threshold — keep that
    // one-shot promise from #295 honest on the fruit path too.
    if (
      !state.extraLifeAwarded &&
      scoreBeforeFruit < EXTRA_LIFE_SCORE &&
      state.score >= EXTRA_LIFE_SCORE
    ) {
      state.lives += 1;
      state.extraLifeAwarded = true;
      state.extraLifeBanner = EXTRA_BANNER_TICKS;
    }
  }

  // 4. Eat pellet if one lives on this tile. Power pellets ('o' in the
  //    static MAZE) and regular pellets ('.') share the same boolean
  //    pelletMap, so we re-check the static tile to distinguish them
  //    for scoring + the frightened-mode trigger surfaced via result.
  const row = state.pelletMap[pac.y];
  if (row && row[pac.x]) {
    row[pac.x] = false;
    state.pellets -= 1;
    const dotsBefore = state.dotsEaten;
    state.dotsEaten = dotsBefore + 1;
    const dotsAfter = state.dotsEaten;
    // Issue #305 — arcade-canon fruit triggers: cross 70 dots → spawn 1,
    // cross 170 dots → spawn 2. Same tick as the pellet that crossed.
    // Guarded by `fruitSpawnsThisLevel` so a hypothetical re-trip can't
    // re-arm. The fruit slot is single — a fresh trip overwrites the
    // first (in canon the first vanishes well before 170 dots anyway,
    // but be defensive). One word, one slot: BANNER_FRUIT.
    const crossedFirst =
      dotsBefore < FRUIT_FIRST_DOTS && dotsAfter >= FRUIT_FIRST_DOTS;
    const crossedSecond =
      dotsBefore < FRUIT_SECOND_DOTS && dotsAfter >= FRUIT_SECOND_DOTS;
    if (
      (crossedFirst && state.fruitSpawnsThisLevel < 1) ||
      (crossedSecond && state.fruitSpawnsThisLevel < 2)
    ) {
      // Read the runtime `level` mirror the engine attaches to state.
      // 1-indexed; clamp into the FRUIT_SCORES / FRUIT_KINDS table.
      const lvlRaw =
        (state as GameState & { level?: number }).level ?? 1;
      const lvl = Math.max(1, Math.min(lvlRaw, FRUIT_SCORES.length));
      const value = FRUIT_SCORES[lvl - 1] ?? 100;
      const kind = FRUIT_KINDS[lvl - 1] ?? "cherry";
      state.fruit = {
        x: FRUIT_SPAWN_X,
        y: FRUIT_SPAWN_Y,
        kind,
        value,
        ticksRemaining: FRUIT_LIFETIME_TICKS,
      };
      state.fruitBanner = FRUIT_BANNER_TICKS;
      state.fruitSpawnsThisLevel += 1;
    }
    const staticTile = MAZE[pac.y]?.[pac.x];
    const isPower = staticTile === "o";
    const scoreBefore = state.score;
    if (isPower) {
      state.score += 50;
      result.atePowerPellet = true;
    } else {
      state.score += 10;
    }
    // Issue #295 — arcade canon: free life at 10,000. One-shot — the
    // `extraLifeAwarded` latch on GameState ensures the threshold fires
    // exactly once per game (not per level, not per crossing-back-up).
    // The threshold check lives here, on the score-bump path, so it
    // catches the SAME tick the score crosses 10000 — no off-by-one
    // where the player sees 10010 on the HUD before lives bump.
    if (
      !state.extraLifeAwarded &&
      scoreBefore < EXTRA_LIFE_SCORE &&
      state.score >= EXTRA_LIFE_SCORE
    ) {
      state.lives += 1;
      state.extraLifeAwarded = true;
      state.extraLifeBanner = EXTRA_BANNER_TICKS;
    }
    // Issue #138 — pellet-pickup juice. Pure data: engine decays per
    // tick (before this write), renderer reads. Power pellet gets a
    // fatter package — bigger squash, more sparkles, and a screen
    // flash that telegraphs the room-rule flip.
    const fb = state.feedback;
    fb.pacSquash = isPower ? 0.25 : 0.12;
    fb.popups.push({
      x: pac.x,
      y: pac.y,
      value: isPower ? 50 : 10,
      ageTicks: 0,
    });
    const sparkleCount = isPower ? 12 : 4;
    const sparkleSpeed = isPower ? 0.6 : 0.4;
    // Deterministic angular distribution so the spec contract holds
    // across runs — evenly spaced rays from the eaten tile center.
    for (let i = 0; i < sparkleCount; i += 1) {
      const theta = (i / sparkleCount) * Math.PI * 2;
      fb.sparkles.push({
        x: pac.x + 0.5,
        y: pac.y + 0.5,
        vx: Math.cos(theta) * sparkleSpeed,
        vy: Math.sin(theta) * sparkleSpeed,
        ageTicks: 0,
      });
    }
    if (isPower) {
      fb.flashAlpha = 0.18;
    }
  }
  return result;
}

/** Test/debug helper: set the queued direction. */
export function queueDirection(state: GameState, dir: Direction): void {
  state.pac.queued = dir;
}
