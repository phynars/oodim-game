// Enemy formation + entrance choreography + diving attacks (Galaga issues
// #33 + #34).
//
// The arcade's signature opening: waves of enemies fly in along curving
// entrance arcs from off-screen, settle into a rectangular grid near the top,
// and "breathe" — the whole formation slides side-to-side as one body. Once
// the formation is settled, enemies periodically peel off ('diving') and
// sweep down at the player along a curved path, then loop back to their
// formation slot. This module owns the roster lifecycle and produces NEW
// enemy snapshots each tick; the engine just calls `tick(currentTick)` and
// stores the result on the shared `GameState`. Keeping the math here (not in
// engine.ts) means the engine stays a thin orchestrator and the formation
// can be unit-tested in isolation later.
//
// Coordinate convention matches `types.ts`: pixel-space, origin top-left,
// centers (not corners). All easing/curves are pure functions of
// `t = ticksAlive / DURATION` so the choreography is deterministic given
// the spawn schedule — important for the e2e harness which asserts every
// enemy reaches `'formation'` within a bounded number of ticks, and that an
// enemy enters `'diving'` with increasing `y` during the dive.

import { HEIGHT, WIDTH, type Enemy, type EnemyKind } from "./types";

// --- Formation geometry ------------------------------------------------------
//
// Classic Galaga packs 40 enemies into a 10-wide × 5-tall grid: the top two
// rows are bosses+butterflies, the bottom three are bees. We mirror that
// roster ratio at a smaller count (more readable on a 320px-wide canvas and
// quicker for the e2e assertion to converge). The grid sits in the upper
// third of the playfield so the player has room to maneuver below.

const COLS = 8;
const ROWS = 5;
/** Pixel pitch between formation slots. */
const COL_SPACING = 28;
const ROW_SPACING = 22;
/** Center y of the TOP row. Subsequent rows step down by ROW_SPACING. */
const FORMATION_TOP_Y = 70;

/** Rows, top-down, mapped to their archetype. Top row is bosses (the prize
 *  targets), then butterflies, then two rows of bees. */
const ROW_KIND: EnemyKind[] = ["boss", "butterfly", "butterfly", "bee", "bee"];

/** How many ticks an entrance arc takes from spawn to settled slot. At 60Hz
 *  that's ~1.5s per enemy. Multiple enemies fly simultaneously (staggered by
 *  SPAWN_INTERVAL) so the whole formation lands in well under 5 seconds. */
const ENTRANCE_TICKS = 90;

/** Ticks between successive enemy spawns. Smaller = denser stream. */
const SPAWN_INTERVAL = 4;

/** Side-to-side amplitude of the breathing formation (px). */
const BREATHE_AMPLITUDE = 12;
/** Angular speed of the breathing oscillation (radians/tick). 2π/240 ≈ 4s
 *  cycle, the same languid sway the arcade has. */
const BREATHE_OMEGA = (2 * Math.PI) / 240;

// --- Diving choreography -----------------------------------------------------
//
// Once an enemy has reached its formation slot, it becomes eligible to dive.
// We stagger dives so the formation doesn't empty out at once: the first
// dive fires shortly after the formation settles, then a fresh dive begins
// every DIVE_INTERVAL ticks. Each dive lasts DIVE_TICKS, half descending
// toward the player's altitude and half climbing back to the formation slot.
//
// The dive path is a quadratic Bézier: P0 = formation slot (the breathing
// position is captured at dive start so the curve begins exactly where the
// sprite was rendered), P1 = a control point pulled down toward the bottom
// of the field and laterally offset toward the player half, P2 = the
// formation slot again. With t ∈ [0,1], the curve reaches its max y near
// t=0.5 — that's the descent — and returns by t=1.

/** How many ticks one dive takes from peel-off to return-to-formation. At
 *  60Hz that's ~2s — long enough for `y` to visibly increase, short enough
 *  the e2e harness can wait for it without flake. */
const DIVE_TICKS = 120;

/** First dive begins this many ticks after the LAST enemy has settled. Gives
 *  the harness a chance to confirm the formation state first. */
const DIVE_START_DELAY = 30;

/** Ticks between successive dive starts. Smaller = more divers in the air. */
const DIVE_INTERVAL = 45;

/** Internal per-enemy bookkeeping the engine doesn't need to know about.
 *  We keep an internal mirror so the public `Enemy` shape on GameState stays
 *  the minimal `{id,kind,state,x,y}` contract from types.ts. */
interface EnemyInternal {
  id: number;
  kind: EnemyKind;
  /** Grid slot — column 0..COLS-1, row 0..ROWS-1. Defines the home position. */
  col: number;
  row: number;
  /** Tick this enemy was spawned (started flying its arc). */
  spawnTick: number;
  /** Which entrance arc: -1 sweeps in from the left, +1 from the right. */
  arcSide: -1 | 1;
  state: "entering" | "formation" | "diving";
  x: number;
  y: number;
  /** Tick this enemy began its current dive (null when not diving). */
  diveStartTick: number | null;
  /** Bézier control point captured at dive start — locks the curve shape so
   *  the breathing sway during the dive doesn't warp the arc mid-flight. */
  diveP0x: number;
  diveP0y: number;
  diveP1x: number;
  diveP1y: number;
}

export interface EnemyController {
  /** Advance the formation by one fixed-step tick and return the public
   *  snapshot (what gets stored on `GameState.enemies`). */
  tick(currentTick: number): Enemy[];
}

/** Total ticks from currentTick=0 until every enemy has settled. Useful for
 *  tests / debugging — the e2e assertion waits well past this. */
export function totalEntranceTicks(): number {
  const lastSpawn = (COLS * ROWS - 1) * SPAWN_INTERVAL;
  return lastSpawn + ENTRANCE_TICKS;
}

/** Build the full roster up front, each scheduled to begin its entrance arc
 *  on a staggered tick. Until its spawnTick fires, an enemy is "off-stage" —
 *  we don't include it in the published roster. */
export function createEnemyController(): EnemyController {
  const roster: EnemyInternal[] = [];
  let id = 1;
  // Spawn order: weave column-by-column, alternating sides — gives the
  // classic two-streams-converging look without a dedicated path table.
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const order = c * ROWS + r;
      roster.push({
        id: id++,
        kind: ROW_KIND[r] ?? "bee",
        col: c,
        row: r,
        spawnTick: order * SPAWN_INTERVAL,
        // Even columns from the left, odd from the right.
        arcSide: c % 2 === 0 ? -1 : 1,
        state: "entering",
        // Off-screen until spawn; tick() overwrites these.
        x: -100,
        y: -100,
        diveStartTick: null,
        diveP0x: 0,
        diveP0y: 0,
        diveP1x: 0,
        diveP1y: 0,
      });
    }
  }

  // First dive begins after the whole formation has settled, plus a small
  // delay so the harness can observe the all-settled state first.
  const firstDiveTick = totalEntranceTicks() + DIVE_START_DELAY;

  // Deterministic dive order — interleaves rows + columns so the divers
  // don't all come from the same corner. Using ((c*ROWS)+r)*7 mod COLS*ROWS
  // gives a pseudo-shuffled but stable sequence.
  const total = COLS * ROWS;
  const diveOrder: number[] = [];
  for (let i = 0; i < total; i++) {
    diveOrder.push((i * 7) % total);
  }
  // De-dupe while preserving order (7 is coprime with total=40, so this is
  // already a permutation, but stay defensive in case COLS/ROWS change).
  const seen = new Set<number>();
  const orderedIndexes: number[] = [];
  for (const idx of diveOrder) {
    if (!seen.has(idx)) {
      seen.add(idx);
      orderedIndexes.push(idx);
    }
  }

  return {
    tick(currentTick: number): Enemy[] {
      const out: Enemy[] = [];

      // 1. Maybe start a new dive this tick. We look at the global "dive
      //    slot" — number of dives that should have begun by now — and if
      //    the next slot's time has arrived, pick the next un-diving formation
      //    enemy from the deterministic order and launch it.
      if (currentTick >= firstDiveTick) {
        const slotsElapsed =
          Math.floor((currentTick - firstDiveTick) / DIVE_INTERVAL) + 1;
        // Count how many dives have actually started so far — start more
        // until we catch up to slotsElapsed (typically one per tick when due).
        let started = 0;
        for (const e of roster) {
          if (e.diveStartTick !== null) started++;
        }
        while (started < slotsElapsed && started < orderedIndexes.length) {
          const candidateIdx = orderedIndexes[started];
          const candidate = roster[candidateIdx];
          // Only launch if the candidate is currently parked in formation.
          // If it's still entering (shouldn't happen past firstDiveTick) or
          // already diving, skip to the next slot.
          if (
            candidate &&
            candidate.state === "formation" &&
            candidate.diveStartTick === null
          ) {
            // Capture the current rendered position as P0 so the curve starts
            // exactly where the breathing sprite is — no visual snap.
            const home = formationSlot(candidate.col, candidate.row);
            const sway =
              Math.sin(currentTick * BREATHE_OMEGA) * BREATHE_AMPLITUDE;
            candidate.diveP0x = home.x + sway;
            candidate.diveP0y = home.y;
            // Control point: pull the curve down to the lower playfield and
            // sideways toward the center / opposite half so the dive sweeps
            // across the screen rather than straight down (classic Galaga
            // dives are S-shaped relative to the formation).
            const sideSign = candidate.col < COLS / 2 ? 1 : -1;
            candidate.diveP1x = WIDTH / 2 + sideSign * WIDTH * 0.25;
            candidate.diveP1y = HEIGHT - 40;
            candidate.diveStartTick = currentTick;
            candidate.state = "diving";
          }
          started++;
        }
      }

      // 2. Per-enemy per-tick position update.
      for (const e of roster) {
        if (currentTick < e.spawnTick) continue; // not yet on stage

        const ticksAlive = currentTick - e.spawnTick;
        const home = formationSlot(e.col, e.row);

        if (e.diveStartTick !== null) {
          // Mid-dive. Advance along the Bézier; when finished, return to
          // formation (the e2e contract requires the returning transition).
          const diveT = (currentTick - e.diveStartTick) / DIVE_TICKS;
          if (diveT >= 1) {
            // Dive complete — snap back to the formation lifecycle. We clear
            // diveStartTick so this enemy is again eligible for a future
            // dive slot (though our scheduler only launches each enemy once
            // in this slice; revisiting is a follow-up backlog item).
            e.diveStartTick = null;
            e.state = "formation";
            const sway =
              Math.sin(currentTick * BREATHE_OMEGA) * BREATHE_AMPLITUDE;
            e.x = home.x + sway;
            e.y = home.y;
          } else {
            const eased = easeInOutCubic(diveT);
            const pos = diveCurve(
              eased,
              e.diveP0x,
              e.diveP0y,
              e.diveP1x,
              e.diveP1y,
            );
            e.state = "diving";
            e.x = pos.x;
            e.y = pos.y;
          }
        } else if (ticksAlive >= ENTRANCE_TICKS) {
          // Settled — breathe as one body.
          e.state = "formation";
          const sway = Math.sin(currentTick * BREATHE_OMEGA) * BREATHE_AMPLITUDE;
          e.x = home.x + sway;
          e.y = home.y;
        } else {
          // Flying the entrance arc. `t` runs 0→1 over ENTRANCE_TICKS.
          const t = ticksAlive / ENTRANCE_TICKS;
          const eased = easeInOutCubic(t);
          const arc = entranceArc(e.arcSide, eased, home);
          e.state = "entering";
          e.x = arc.x;
          e.y = arc.y;
        }

        out.push({ id: e.id, kind: e.kind, state: e.state, x: e.x, y: e.y });
      }
      return out;
    },
  };
}

/** Home (settled) position of a grid slot, BEFORE the breathing sway is
 *  applied. Centered horizontally so odd column counts still look balanced. */
function formationSlot(col: number, row: number): { x: number; y: number } {
  const gridWidth = (COLS - 1) * COL_SPACING;
  const startX = (WIDTH - gridWidth) / 2;
  return {
    x: startX + col * COL_SPACING,
    y: FORMATION_TOP_Y + row * ROW_SPACING,
  };
}

/** Entrance arc from off-screen to the home slot. We start above the field
 *  on the chosen side, swoop down past the middle, then curve up into place.
 *  A quadratic Bézier through a control point off-side gives the right feel
 *  without a baked path table; `t` is the EASED parameter (0..1). */
function entranceArc(
  side: -1 | 1,
  t: number,
  home: { x: number; y: number },
): { x: number; y: number } {
  // P0: off-screen entry point (above the top, on `side`).
  const p0x = side < 0 ? -20 : WIDTH + 20;
  const p0y = -30;
  // P1: control point — pull the curve down into the lower playfield and
  // across to the opposite side so the swoop feels generous.
  const p1x = side < 0 ? WIDTH * 0.75 : WIDTH * 0.25;
  const p1y = HEIGHT * 0.55;
  // P2: settle into the home slot.
  const p2x = home.x;
  const p2y = home.y;

  const u = 1 - t;
  const x = u * u * p0x + 2 * u * t * p1x + t * t * p2x;
  const y = u * u * p0y + 2 * u * t * p1y + t * t * p2y;
  return { x, y };
}

/** Dive curve — quadratic Bézier from (p0x,p0y) through control (p1x,p1y)
 *  back to (p0x,p0y). Because P2 = P0, the path forms a loop: descend to
 *  the control's vicinity by t≈0.5, climb back home by t=1. `t` is the
 *  EASED parameter (0..1). */
function diveCurve(
  t: number,
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
): { x: number; y: number } {
  const u = 1 - t;
  const x = u * u * p0x + 2 * u * t * p1x + t * t * p0x;
  const y = u * u * p0y + 2 * u * t * p1y + t * t * p0y;
  return { x, y };
}

/** Smoothstep-ish ease so the arc starts gentle, accelerates, then settles. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
