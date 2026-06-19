// Enemy AI — issue #77, extended by #81 (ranged fire).
//
//   idle      → holding position; flips to 'chasing' once the player is
//               within VISION_RADIUS (no line-of-sight check yet — walls
//               occlude movement but not sight; LoS is a backlog follow-up).
//   chasing   → step toward the player along the floor each tick, per-axis
//               collision-clamped against level walls (same predicate the
//               player uses). Flips to 'attacking' once within the kind's
//               attack band, drops back to 'chasing' if the player slips out.
//   attacking → in range and ticking the shared attackCooldown. On the tick
//               it crosses 0, the AI returns a fire signal (the engine
//               decides what to spawn — a melee bite or a projectile —
//               keyed off the enemy's kind via RANGED_KINDS).
//   dead      → terminal; the engine culls one tick after entry.
//
// The AI is a PURE function of (enemy, player, level): no Math.random, no
// wall-clock reads. The engine calls stepEnemyAI() once per fixed-step per
// live enemy — same determinism contract as the player movement path.
//
// COOLDOWN UNIFICATION (post-#79 follow-up Soren flagged on #112): we keep a
// SINGLE `attackCooldown` field on Enemy that both melee and ranged kinds
// drive. The return shape is `{ fires, damage }` so the engine can branch:
//   - ranged kind + fires=true  → spawn a projectile (damage=0 here; the
//                                 projectile carries its own damage payload)
//   - melee kind + fires=true   → apply damage immediately to the player
//                                 (damage>0 — the melee bite slice will
//                                 read this directly)
// Melee kinds currently report damage=0 on fire-this-tick because the
// melee-damage application path is the next backlog slice; this PR doesn't
// invent that behavior, but the contract is shaped for it so when the
// melee-damage slice lands it just reads stepEnemyAI's return.

import { collidesAt } from "./level";
import {
  ATTACK_INITIAL_COOLDOWN_TICKS,
  MELEE_COOLDOWN_TICKS,
  RANGED_COOLDOWN_TICKS,
  RANGED_KINDS,
  type Enemy,
  type PlayerState,
} from "./types";

/** Distance (world units) within which a resting enemy notices the player and
 *  transitions idle → chasing. The seeded roster sits 11–15 u in front of the
 *  player's spawn, so the default 14 catches the nearest two on spawn; the
 *  baron at the back stays idle until the player advances. The e2e harness
 *  pushes the player adjacent to an enemy, so the threshold doesn't matter
 *  for that test — but a tight default keeps idle enemies idle off-camera.
 *
 *  NOTE: vision is symmetric — once chasing, an enemy keeps chasing even if
 *  the player runs out of VISION_RADIUS. That matches classic FPS behavior
 *  (an aggro'd grunt doesn't politely disengage) and keeps the state machine
 *  one-way except for the chasing ↔ attacking band. */
export const VISION_RADIUS = 14;

/** Distance at which a MELEE enemy stops to attack. Set just above the
 *  player's collision radius + a typical enemy half-size so the enemy halts
 *  with its body flush against the player rather than pushing inside them.
 *  Tunable as combat tuning lands. */
export const ATTACK_RANGE = 1.5;

/** Enemy walking speed, world units per fixed-step (60 Hz). 0.05 u/step =
 *  3 u/s — slower than the player's 4.8 u/s so the player can kite. */
export const ENEMY_SPEED_PER_TICK = 0.05;

/** Radius of the enemy's collision footprint against walls. Smaller than the
 *  player's radius so a chasing enemy can squeeze through 2u corridors
 *  without snagging on a cell corner. */
export const ENEMY_RADIUS = 0.25;

/** Distance at which a RANGED enemy stops to attack from afar. Larger than
 *  melee ATTACK_RANGE so barons hold ground at fireball range instead of
 *  closing into the player's face. Below VISION_RADIUS so a ranged enemy can
 *  still acquire and then halt. */
export const RANGED_ATTACK_RANGE = 8;

/** Result of one AI step.
 *   - `fires`  : true on the tick the enemy's attackCooldown elapses while
 *                in 'attacking'. The engine reads this to spawn a projectile
 *                (ranged) or apply melee damage (melee).
 *   - `damage` : damage to apply to the player THIS tick. For ranged kinds
 *                the projectile carries its own damage payload, so this is
 *                0 (the spawn IS the side-effect). For melee kinds this
 *                will be the bite damage when the melee-damage slice lands;
 *                currently 0 (contract is in place for the follow-up).
 *
 *  This shape composes: a future melee-damage slice fills in `damage>0` for
 *  melee fires without re-plumbing engine.ts. */
export interface EnemyStepResult {
  fires: boolean;
  damage: number;
}

const NO_FIRE: EnemyStepResult = { fires: false, damage: 0 };

/** Advance one enemy by one fixed-step. MUTATES the enemy in place — the
 *  caller (engine.update) owns the roster, so this avoids per-tick
 *  allocations. Dead enemies are a no-op (the engine culls them the tick
 *  after death).
 *
 *  Returns an EnemyStepResult; see the type doc for the contract. */
export function stepEnemyAI(
  enemy: Enemy,
  player: PlayerState,
): EnemyStepResult {
  if (enemy.state === "dead") return NO_FIRE;

  // Range to the player on the floor plane (y is the enemy/player vertical
  // offset, irrelevant for movement + AI gating).
  const dx = player.x - enemy.x;
  const dz = player.z - enemy.z;
  const dist = Math.hypot(dx, dz);

  // --- State transitions ---------------------------------------------------
  // Ranged kinds hold at RANGED_ATTACK_RANGE (fireball distance); melee
  // kinds close to ATTACK_RANGE (bite). Both share the same
  // idle→chasing→attacking↔chasing topology and the same attackCooldown
  // field (unified after Soren's #112 review).
  const ranged = RANGED_KINDS[enemy.kind];
  const attackBand = ranged ? RANGED_ATTACK_RANGE : ATTACK_RANGE;

  if (enemy.state === "idle") {
    if (dist <= VISION_RADIUS) enemy.state = "chasing";
  } else if (enemy.state === "chasing") {
    if (dist <= attackBand) {
      enemy.state = "attacking";
      // Prime a short windup on first acquisition so the first attack
      // fires promptly instead of holding for the full cooldown.
      if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown = ATTACK_INITIAL_COOLDOWN_TICKS;
      }
    }
  } else if (enemy.state === "attacking") {
    if (dist > attackBand) enemy.state = "chasing";
  }

  // --- Attack tick ---------------------------------------------------------
  // While attacking, count the cooldown down. On the tick it crosses 0,
  // signal a fire-this-tick and reset to the kind-appropriate cadence
  // (ranged is slow + heavy, melee is fast + chip — tuning lives in types.ts).
  // We REQUIRE dist > 0 so a degenerate overlap doesn't divide-by-zero
  // when the engine computes the projectile direction (ranged) or apply
  // a same-cell melee bite ambiguously (the engine treats dist=0 as
  // "standing on the player" — out of band).
  if (enemy.state === "attacking" && dist > 0) {
    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown -= 1;
    }
    if (enemy.attackCooldown <= 0) {
      enemy.attackCooldown = ranged
        ? RANGED_COOLDOWN_TICKS
        : MELEE_COOLDOWN_TICKS;
      // Ranged: damage rides on the projectile (the engine spawns one and
      // stepProjectiles applies ENEMY_PROJECTILE_DAMAGE on contact). Melee:
      // the melee-damage application slice fills in damage>0 here; for now
      // we report fires=true with damage=0 so the contract is shaped right
      // without inventing a behavior #79 chose not to ship.
      return { fires: true, damage: 0 };
    }
  }

  // --- Movement ------------------------------------------------------------
  // Only chasing enemies move. Attacking enemies hold position. Idle enemies
  // are rooted by definition.
  if (enemy.state !== "chasing") return NO_FIRE;
  if (dist === 0) return NO_FIRE; // standing on the player; nothing to do

  // Unit vector toward the player, scaled to one tick's worth of travel.
  const stepX = (dx / dist) * ENEMY_SPEED_PER_TICK;
  const stepZ = (dz / dist) * ENEMY_SPEED_PER_TICK;

  // Per-axis collision against level walls — same pattern the player uses.
  // Resolving x and z independently lets a chasing enemy slide along a wall
  // toward the player instead of getting stuck at a corner.
  const nextX = enemy.x + stepX;
  if (!collidesAt(nextX, enemy.z, ENEMY_RADIUS)) enemy.x = nextX;
  const nextZ = enemy.z + stepZ;
  if (!collidesAt(enemy.x, nextZ, ENEMY_RADIUS)) enemy.z = nextZ;

  return NO_FIRE;
}
