// Enemy formation + entrance choreography.
//
// Galaga's signature opening: enemies don't pop into the grid — they fly in
// along curved entrance arcs from off-screen, then settle into a breathing
// formation. This module owns the roster: it builds the formation grid,
// spawns the entrance waves, and ticks each enemy along its arc until it
// "parks" at its assigned formation slot. Once parked, the enemy switches
// to `state:'formation'` and idles (a gentle horizontal breathing sway).
//
// Scope of this slice (issue #33):
//   - Populate `state.enemies` with `{id,kind,state,x,y}`.
//   - Three kinds present: bee, butterfly, boss.
//   - Every enemy reaches `'formation'` within a bounded number of ticks.
//
// Out of scope (later slices): diving attack runs, boss capture beam,
// dual-fighter rescue, stage progression. Those will mutate `state` further
// once an enemy is parked, but they all start from the formation grid this
// module builds.

import { WIDTH, type Enemy, type EnemyKind, type GameState } from "./types";

// Formation grid geometry. Galaga's classic layout is 10 columns × 5 rows.
// We render it shorter (3 rows = 14 enemies) for the scaffold's playfield —
// the contract just requires all three kinds and a settled formation, not
// the full 40-enemy roster (later slice can scale rows up).
const FORMATION_COLS = 7;
const FORMATION_ROWS = 3;
const COL_SPACING = 32;
const ROW_SPACING = 28;
const FORMATION_TOP_Y = 64;

// Entrance choreography: each enemy takes a curved arc from an off-screen
// spawn point to its formation slot. We use a parametric ease (0..1) over a
// fixed tick budget — bounded so the e2e test can wait deterministically.
const ENTRANCE_TICKS = 90; // ~1.5s at 60Hz

// Staggered launch — enemies don't all enter at once; the wave reads as a
// procession. Each enemy gets a delay = its index × this many ticks.
const STAGGER_TICKS = 6;

// Breathing sway in formation: subtle horizontal oscillation so the grid
// feels alive (the arcade did this too). Amplitude small enough not to
// confuse collision tests.
const BREATH_AMPLITUDE_PX = 4;
const BREATH_PERIOD_TICKS = 180;

interface FormationSlot {
  col: number;
  row: number;
  /** Final resting x in the grid (center of the slot). */
  homeX: number;
  /** Final resting y in the grid. */
  homeY: number;
}

interface EntranceArc {
  /** Spawn point off-screen (where the enemy starts the arc). */
  startX: number;
  startY: number;
  /** Control point for a quadratic bezier curve into the slot. */
  ctrlX: number;
  ctrlY: number;
  /** Tick (engine tick) at which this enemy was launched. */
  launchedAt: number;
}

interface Choreography {
  slot: FormationSlot;
  arc: EntranceArc;
}

/** Per-enemy choreography keyed by enemy id. Module-private state — the
 *  engine treats enemies as opaque; only `enemies.ts` knows the arcs. */
const choreographies = new Map<number, Choreography>();

let nextId = 1;

/** Compute the formation grid slots. Row 0 = top (bosses), then butterflies,
 *  then bees on the bottom row — classic Galaga vertical ordering. */
function buildFormation(): FormationSlot[] {
  const slots: FormationSlot[] = [];
  // Center the grid horizontally on the playfield.
  const gridWidth = (FORMATION_COLS - 1) * COL_SPACING;
  const leftX = (WIDTH - gridWidth) / 2;
  for (let row = 0; row < FORMATION_ROWS; row++) {
    for (let col = 0; col < FORMATION_COLS; col++) {
      slots.push({
        col,
        row,
        homeX: leftX + col * COL_SPACING,
        homeY: FORMATION_TOP_Y + row * ROW_SPACING,
      });
    }
  }
  return slots;
}

/** Kind assignment by row: top row = boss, middle = butterfly, bottom = bee.
 *  Guarantees all three kinds appear (contract requirement). */
function kindForRow(row: number): EnemyKind {
  if (row === 0) return "boss";
  if (row === 1) return "butterfly";
  return "bee";
}

/** Pick an entrance arc for a slot. Bosses + odd columns swing in from the
 *  left; even columns swing in from the right — gives the procession its
 *  signature alternating-stream look. */
function arcForSlot(slot: FormationSlot, launchedAt: number): EntranceArc {
  const fromLeft = slot.col % 2 === 0;
  const startX = fromLeft ? -20 : WIDTH + 20;
  const startY = -20;
  // Control point puts a meaningful curve into the path — pulled toward the
  // opposite side so the arc loops gently before settling.
  const ctrlX = fromLeft ? WIDTH * 0.85 : WIDTH * 0.15;
  const ctrlY = slot.homeY + 60;
  return { startX, startY, ctrlX, ctrlY, launchedAt };
}

/** Quadratic bezier point at t∈[0,1]. */
function bezier(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/** Spawn the full wave: populate `state.enemies` with one enemy per slot,
 *  all starting in `'entering'` at their arc origin. Idempotent — calling
 *  twice while enemies exist is a no-op.
 *
 *  Idempotency is keyed on `state.enemies.length`, NOT a module-level
 *  "already-spawned" flag — that flag was a foot-gun for the future
 *  "new game" path (a fresh `initialState()` produces an empty roster,
 *  but a stale flag would suppress the respawn). Calling this with an
 *  empty roster also clears the module-private choreography map, so we
 *  don't leak per-enemy entries across game resets.
 *
 *  `launchedAt` is anchored to the CURRENT engine tick (not 0), so the
 *  entrance choreography starts the moment the wave spawns regardless
 *  of when that happens — important for the eventual "new wave per
 *  stage" path, where waves spawn mid-game with `state.tick > 0`. */
export function spawnWave(state: GameState): void {
  if (state.enemies.length > 0) return;
  // Fresh wave → drop any choreography left over from a previous game.
  choreographies.clear();
  nextId = 1;
  const slots = buildFormation();
  // Order the spawn so bees (front-line) launch first, then butterflies,
  // then bosses — feels like the swarm builds up to the heavies.
  const ordered = [...slots].sort((a, b) => b.row - a.row || a.col - b.col);
  const spawnTick = state.tick;
  ordered.forEach((slot, index) => {
    const id = nextId++;
    const arc = arcForSlot(slot, spawnTick + index * STAGGER_TICKS);
    choreographies.set(id, { slot, arc });
    const enemy: Enemy = {
      id,
      kind: kindForRow(slot.row),
      state: "entering",
      x: arc.startX,
      y: arc.startY,
    };
    state.enemies.push(enemy);
  });
}

/** Advance every enemy one tick. Entering enemies traverse their arc; once
 *  they reach the slot they flip to `'formation'` and breathe in place. */
export function tickEnemies(state: GameState): void {
  if (state.enemies.length === 0) return;
  for (const enemy of state.enemies) {
    const choreo = choreographies.get(enemy.id);
    if (!choreo) continue;
    if (enemy.state === "entering") {
      const elapsed = state.tick - choreo.arc.launchedAt;
      if (elapsed < 0) {
        // Not launched yet — wait at the arc start.
        enemy.x = choreo.arc.startX;
        enemy.y = choreo.arc.startY;
        continue;
      }
      const t = Math.min(1, elapsed / ENTRANCE_TICKS);
      enemy.x = bezier(choreo.arc.startX, choreo.arc.ctrlX, choreo.slot.homeX, t);
      enemy.y = bezier(choreo.arc.startY, choreo.arc.ctrlY, choreo.slot.homeY, t);
      if (t >= 1) {
        enemy.state = "formation";
        enemy.x = choreo.slot.homeX;
        enemy.y = choreo.slot.homeY;
      }
    } else if (enemy.state === "formation") {
      // Breathing sway — keeps the grid alive without disturbing collisions.
      const phase = (state.tick / BREATH_PERIOD_TICKS) * Math.PI * 2;
      enemy.x = choreo.slot.homeX + Math.sin(phase) * BREATH_AMPLITUDE_PX;
      enemy.y = choreo.slot.homeY;
    }
    // Other states (diving, capturing, escort) are owned by later slices.
  }
}


