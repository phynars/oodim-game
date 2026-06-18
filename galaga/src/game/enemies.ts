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

import {
  CHALLENGING_WAVE_COUNT,
  HEIGHT,
  WIDTH,
  type Enemy,
  type EnemyKind,
} from "./types";

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
  state: "entering" | "formation" | "diving" | "capturing" | "escort";
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
  /** True while this boss is descending with its tractor beam armed. The
   *  controller holds it stationary above (capturePlayerX, capturePlayerY)
   *  so the engine's beam-overlap check is deterministic. */
  capturing: boolean;
  /** When `capturing`, the (locked) anchor position the boss hovers at —
   *  ~80px above the player's y at trigger time. */
  captureAnchorX: number;
  captureAnchorY: number;
  /** When non-null this enemy is an 'escort' (captured player fighter)
   *  locked above the boss with id `escortOf`. */
  escortOf: number | null;
}

export interface EnemyController {
  /** Advance the formation by one fixed-step tick and return the public
   *  snapshot (what gets stored on `GameState.enemies`). */
  tick(currentTick: number): Enemy[];
  /** True once at least one enemy has appeared on stage (its spawnTick has
   *  fired). The engine uses this to distinguish "formation not started yet"
   *  from "formation cleared" — only the latter advances the stage. */
  hasSpawnedAny(): boolean;
  /** True when the internal roster is completely empty — every enemy this
   *  stage spawned has been killed AND there are no pending spawns left
   *  in the schedule. The engine pairs this with `hasSpawnedAny()` to
   *  fire stage-clear: 'something existed, and now it doesn't'. */
  isEmpty(): boolean;
  /** Rebuild a fresh roster for the next stage. The engine calls this after
   *  detecting `enemies.length === 0` post-clear; subsequent `tick()` calls
   *  should treat `currentTick=0` as the start of a new entrance choreography
   *  (the engine re-anchors its `formationStartTick` to match). */
  reset(): void;
  /** Remove the enemy with this id from the internal roster, so a kill via
   *  `forceHit`/bullet collision actually empties the formation. Without this
   *  the controller would re-emit the slain enemy on the next tick from its
   *  persistent roster. */
  remove(id: number): void;
  /** Begin the capture beam choreography on a boss positioned above
   *  `(playerX, playerY)`. The boss is parked above the player at a fixed
   *  altitude with its tractor beam armed. Returns the boss id (or null if
   *  no boss is available) — the engine uses this to drive the per-tick
   *  beam-capture check. If `bossId` is given, that specific boss is used;
   *  otherwise the first eligible boss in the roster is chosen. */
  beginCapture(playerX: number, playerY: number, bossId?: number): number | null;
  /** Add an 'escort' enemy locked above the given boss. Returns the new
   *  enemy id. The engine calls this once the capture beam succeeds. */
  addEscort(bossId: number): number;
  /** Id of the 'escort' currently locked above the given boss, or null.
   *  The engine calls this when a boss dies to detect a pending rescue —
   *  if a boss is killed while it owns an escort, the escort is freed and
   *  the player gains the dual fighter. */
  escortOfBoss(bossId: number): number | null;
  /** Center x of the capture beam this tick, or null if no beam is active.
   *  Read by the engine to test player-vs-beam overlap. The beam is a
   *  vertical column anchored to the capturing boss. */
  captureBeamX(): number | null;
  /** Top y of the capture beam (just below the boss), or null. */
  captureBeamTopY(): number | null;
  /** Half-width of the beam column in px. */
  captureBeamHalfWidth(): number;
  /** Rebuild the roster as a Challenging (bonus) stage: a set-pattern wave
   *  that flies through the playfield from top to bottom without parking in
   *  the formation grid. Returns the number of enemies in the wave (so the
   *  engine can track perfect-clear). The engine should re-anchor its
   *  formationStartTick so the wave's choreography plays from t=0. */
  startChallengingStage(): number;
  /** True while a challenging stage is in flight (roster built via
   *  `startChallengingStage` and still has unspawned/onstage enemies). The
   *  engine mirrors this onto `state.challenging`. */
  isChallenging(): boolean;
  /** Total enemies the current challenging wave released onto the field
   *  (the denominator for perfect-clear: `killed === spawned` ⇒ perfect). */
  challengingTotalSpawned(): number;
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
  // Mutable so `reset()` can swap in a fresh stage without breaking the
  // closure references the engine holds.
  let roster: EnemyInternal[] = [];
  // Globally unique ids — never reuse across stages so tests tracking a
  // specific enemy by id can't be confused by a same-id respawn.
  let nextId = 1;
  // Tick offset: when the engine calls reset(), it re-anchors its
  // formationStartTick, so the controller sees `currentTick` restart at 0
  // for the new stage. This matches the original choreography contract
  // (entrance arcs play from t=0).
  let firstDiveTick = 0;
  let orderedIndexes: number[] = [];
  let everPopulated = false;
  /** Id of the boss currently running its capture choreography, or null.
   *  Tracked at controller scope so `captureBeamX/TopY()` can find it in
   *  O(1) and the engine doesn't have to scan the roster each tick. */
  let capturingBossId: number | null = null;
  /** True while the controller is running a Challenging (bonus) stage. The
   *  engine reads this to suppress enemy fire + contact damage and to award
   *  the perfect-clear bonus on stage-end. Set by `startChallengingStage`,
   *  cleared by `reset()`/`buildRoster()`. */
  let challenging = false;
  /** Total enemies released onto the field during the current challenging
   *  wave — the denominator for perfect-clear detection. */
  let challengingSpawned = 0;

  /** (Re)build the roster + dive schedule. Called on construction and again
   *  when the engine clears the formation and asks for a fresh stage. */
  function buildRoster(): void {
    const next: EnemyInternal[] = [];
    // Spawn order: weave column-by-column, alternating sides — gives the
    // classic two-streams-converging look without a dedicated path table.
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const order = c * ROWS + r;
        next.push({
          id: nextId++,
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
          capturing: false,
          captureAnchorX: 0,
          captureAnchorY: 0,
          escortOf: null,
        });
      }
    }
    roster = next;
    everPopulated = false;
    // A buildRoster() is always a NORMAL stage. The challenging path uses
    // `startChallengingStage()` instead, which sets its own flag + roster.
    challenging = false;
    challengingSpawned = 0;

    // First dive begins after the whole formation has settled, plus a small
    // delay so the harness can observe the all-settled state first.
    firstDiveTick = totalEntranceTicks() + DIVE_START_DELAY;

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
    const ordered: number[] = [];
    for (const idx of diveOrder) {
      if (!seen.has(idx)) {
        seen.add(idx);
        ordered.push(idx);
      }
    }
    orderedIndexes = ordered;
  }

  buildRoster();

  return {
    hasSpawnedAny(): boolean {
      return everPopulated;
    },
    isEmpty(): boolean {
      return roster.length === 0;
    },
    reset(): void {
      buildRoster();
    },
    remove(id: number): void {
      // Splice the slain enemy out of the persistent roster so the next
      // `tick()` doesn't re-emit it. The dive scheduler indexes into the
      // roster by position — for this slice the only caller is the stage-
      // clearing collision path, which removes enemies in bulk and then the
      // engine calls `reset()`, so transient index shifts are tolerated.
      for (let i = 0; i < roster.length; i++) {
        if (roster[i].id === id) {
          if (capturingBossId === roster[i].id) capturingBossId = null;
          roster.splice(i, 1);
          return;
        }
      }
    },
    beginCapture(playerX: number, playerY: number, bossId?: number): number | null {
      // Pick the requested boss, or the first 'formation' boss as a fallback
      // — the test harness uses the first-available path. The enemy is
      // pulled out of any dive (we overwrite state) and parked above the
      // player so the beam-overlap check is deterministic.
      let boss: EnemyInternal | undefined;
      if (bossId !== undefined) {
        boss = roster.find((e) => e.id === bossId && e.kind === "boss");
      } else {
        boss = roster.find((e) => e.kind === "boss");
      }
      if (!boss) return null;
      boss.state = "capturing";
      boss.capturing = true;
      boss.diveStartTick = null;
      // Park ~80px above the player so the beam column has a visible run
      // down to the fighter; clamp to stay on stage.
      const anchorY = Math.max(40, playerY - 80);
      boss.captureAnchorX = playerX;
      boss.captureAnchorY = anchorY;
      boss.x = playerX;
      boss.y = anchorY;
      capturingBossId = boss.id;
      return boss.id;
    },
    addEscort(bossId: number): number {
      const boss = roster.find((e) => e.id === bossId);
      const id = nextId++;
      const escort: EnemyInternal = {
        id,
        kind: "bee",
        col: 0,
        row: 0,
        spawnTick: -1,
        arcSide: -1,
        state: "escort",
        // Sit immediately above the boss (or above the field center as a
        // defensive fallback if the boss vanished mid-flight).
        x: boss ? boss.x : WIDTH / 2,
        y: boss ? boss.y - 16 : 40,
        diveStartTick: null,
        diveP0x: 0,
        diveP0y: 0,
        diveP1x: 0,
        diveP1y: 0,
        capturing: false,
        captureAnchorX: 0,
        captureAnchorY: 0,
        escortOf: bossId,
      };
      roster.push(escort);
      return id;
    },
    escortOfBoss(bossId: number): number | null {
      // Linear scan — the roster is small (≤ COLS*ROWS + a handful of
      // escorts) so this is cheap, and it keeps the lookup honest without
      // a second index. Returns the FIRST escort attached to this boss.
      for (const e of roster) {
        if (e.state === "escort" && e.escortOf === bossId) return e.id;
      }
      return null;
    },
    captureBeamX(): number | null {
      if (capturingBossId === null) return null;
      const boss = roster.find((e) => e.id === capturingBossId);
      return boss ? boss.x : null;
    },
    captureBeamTopY(): number | null {
      if (capturingBossId === null) return null;
      const boss = roster.find((e) => e.id === capturingBossId);
      return boss ? boss.y + 6 : null;
    },
    captureBeamHalfWidth(): number {
      return 10;
    },
    startChallengingStage(): number {
      // Replace the roster with a set-pattern flythrough wave. We use a
      // staggered diagonal sweep across columns so the wave reads as
      // CHOREOGRAPHED (set patterns are Challenging's signature), not as
      // a normal entrance-then-park. These enemies never enter 'formation';
      // they fly the entrance arc, then continue straight down past the
      // bottom edge and are despawned by the controller.
      const wave: EnemyInternal[] = [];
      // Cycle through kinds so the wave shows all three archetypes — keeps
      // the visual variety + lets the e2e roster assertion stay green.
      const cycleKinds: EnemyKind[] = ["bee", "butterfly", "boss"];
      for (let i = 0; i < CHALLENGING_WAVE_COUNT; i++) {
        wave.push({
          id: nextId++,
          kind: cycleKinds[i % cycleKinds.length],
          // Reuse the formation slot math for an aiming target — each enemy
          // arcs toward a different column in the top row so the sweep
          // fans across the screen.
          col: i % COLS,
          row: 0,
          spawnTick: i * SPAWN_INTERVAL,
          arcSide: i % 2 === 0 ? -1 : 1,
          state: "entering",
          x: -100,
          y: -100,
          diveStartTick: null,
          diveP0x: 0,
          diveP0y: 0,
          diveP1x: 0,
          diveP1y: 0,
          capturing: false,
          captureAnchorX: 0,
          captureAnchorY: 0,
          escortOf: null,
        });
      }
      roster = wave;
      orderedIndexes = [];
      // Push firstDiveTick out of reach — no dives during a challenging
      // stage. The flythrough IS the choreography.
      firstDiveTick = Number.POSITIVE_INFINITY;
      everPopulated = false;
      capturingBossId = null;
      challenging = true;
      challengingSpawned = 0;
      return wave.length;
    },
    isChallenging(): boolean {
      return challenging;
    },
    challengingTotalSpawned(): number {
      return challengingSpawned;
    },
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
        // Capture/escort enemies skip the entrance + dive math — they're
        // pinned by the capture controller and the engine. We still emit
        // them to the public roster so the e2e harness can read them.
        if (e.state === "capturing") {
          everPopulated = true;
          e.x = e.captureAnchorX;
          e.y = e.captureAnchorY;
          out.push({ id: e.id, kind: e.kind, state: e.state, x: e.x, y: e.y });
          continue;
        }
        if (e.state === "escort") {
          everPopulated = true;
          // Lock above the boss we're escorting; if the boss is gone, hold
          // last known position (the engine frees the escort in that case).
          const boss = e.escortOf !== null
            ? roster.find((r) => r.id === e.escortOf)
            : undefined;
          if (boss) {
            e.x = boss.x;
            e.y = boss.y - 16;
          }
          out.push({ id: e.id, kind: e.kind, state: e.state, x: e.x, y: e.y });
          continue;
        }
        if (currentTick < e.spawnTick) continue; // not yet on stage
        // Count this challenging-wave enemy exactly once: the tick its
        // spawnTick fires equals currentTick (since we just passed the
        // guard above and spawnTick is unique per slot).
        if (challenging && currentTick === e.spawnTick) {
          challengingSpawned += 1;
        }
        everPopulated = true;

        const ticksAlive = currentTick - e.spawnTick;
        const home = formationSlot(e.col, e.row);

        if (challenging) {
          // Challenging-stage trajectory: fly the entrance arc for the first
          // ENTRANCE_TICKS, then continue straight DOWN past the bottom of
          // the playfield. No formation parking, no diving — a single sweep
          // through. State stays 'entering' the whole way so the engine can
          // distinguish challenging flythroughs from normal divers (which
          // also descend) — combined with `state.challenging===true`, the
          // contract is unambiguous.
          if (ticksAlive < ENTRANCE_TICKS) {
            const t = ticksAlive / ENTRANCE_TICKS;
            const eased = easeInOutCubic(t);
            const arc = entranceArc(e.arcSide, eased, home);
            e.state = "entering";
            e.x = arc.x;
            e.y = arc.y;
          } else {
            // Continue downward at a steady speed from the home slot. We
            // don't curve — set patterns in Challenging are simple flythroughs.
            const descentTicks = ticksAlive - ENTRANCE_TICKS;
            e.state = "entering";
            e.x = home.x;
            e.y = home.y + descentTicks * 2; // 2 px/tick = 120 px/s
          }
          // Once an enemy has fallen off the bottom of the playfield, remove
          // it from the persistent roster — it neither survived nor died,
          // it just left. (Killed enemies are spliced via `remove()` from
          // the engine's collision path.) This is also how the challenging
          // stage TERMINATES: once every flythrough enemy has either been
          // shot or flown off, the roster goes empty and the engine's
          // stage-clear path runs.
          if (e.y > HEIGHT + 20) {
            // Defer the splice — mutating roster mid-iteration is the kind
            // of footgun that hides flakes. Mark the enemy by giving it an
            // off-stage y; we'll filter at the bottom of the tick.
            e.y = HEIGHT + 1000;
            continue;
          }
          out.push({ id: e.id, kind: e.kind, state: e.state, x: e.x, y: e.y });
          continue;
        }

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
      // Reap challenging-wave enemies that flew off the bottom (marked with
      // a sentinel y in the loop above). They're removed from the persistent
      // roster so `isEmpty()` correctly flips true once every flythrough has
      // either been shot or escaped — that's the signal the engine uses to
      // award the perfect-clear bonus + advance the stage.
      if (challenging) {
        roster = roster.filter((e) => e.y < HEIGHT + 500);
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
