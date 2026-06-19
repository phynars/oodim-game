// Enemy AI — issue #77. A small state machine per enemy:
//   idle      → holding position; flips to 'chasing' once the player is
//               within VISION_RADIUS (no line-of-sight check yet — walls
//               occlude movement but not sight; LoS is a backlog follow-up).
//   chasing   → step toward the player along the floor each tick, per-axis
//               collision-clamped against level walls (same predicate the
//               player uses). Flips to 'attacking' once within ATTACK_RANGE,
//               drops back to 'chasing' if the player slips out of range.
//   attacking → in melee range; holds position (damage application is the
//               next slice — the state transition is the contract this
//               issue ships).
//   dead      → terminal; the engine culls one tick after entry.
//
// The AI is a PURE function of (enemy, player, level): no Math.random, no
// wall-clock reads. The engine calls stepEnemyAI() once per fixed-step per
// live enemy — same determinism contract as the player movement path.

import { collidesAt } from "./level";
import {
  RANGED_INITIAL_COOLDOWN_TICKS,
  RANGED_KINDS,
  RANGED_COOLDOWN_TICKS,
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

/** Distance at which a chasing enemy stops to attack. Set just above the
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

/** Advance one enemy by one fixed-step. MUTATES the enemy in place — the
 *  caller (engine.update) owns the roster, so this avoids per-tick
 *  allocations. Dead enemies are a no-op (the engine culls them the tick
 *  after death).
 *
 *  Returns TRUE when a ranged archetype's cooldown elapsed THIS tick and the
 *  engine should spawn a projectile at the enemy aimed at the player. Returns
 *  FALSE for melee kinds and for ranged kinds still on cooldown. */
export function stepEnemyAI(enemy: Enemy, player: PlayerState): boolean {
  if (enemy.state === "dead") return false;

  // Range to the player on the floor plane (y is the enemy/player vertical
  // offset, irrelevant for movement + AI gating).
  const dx = player.x - enemy.x;
  const dz = player.z - enemy.z;
  const dist = Math.hypot(dx, dz);

  // --- State transitions ---------------------------------------------------
  // Ranged kinds use RANGED_ATTACK_RANGE (hold at fireball distance); melee
  // kinds use ATTACK_RANGE (close to bite). Both share the same
  // idle→chasing→attacking↔chasing topology.
  const ranged = RANGED_KINDS[enemy.kind];
  const attackBand = ranged ? RANGED_ATTACK_RANGE : ATTACK_RANGE;

  if (enemy.state === "idle") {
    if (dist <= VISION_RADIUS) enemy.state = "chasing";
  } else if (enemy.state === "chasing") {
    if (dist <= attackBand) {
      enemy.state = "attacking";
      // Prime a short windup on first acquisition so a ranged enemy fires
      // promptly instead of holding for the full cooldown.
      if (ranged && enemy.rangedCooldown <= 0) {
        enemy.rangedCooldown = RANGED_INITIAL_COOLDOWN_TICKS;
      }
    }
  } else if (enemy.state === "attacking") {
    if (dist > attackBand) enemy.state = "chasing";
  }

  // --- Ranged fire ---------------------------------------------------------
  // While attacking, tick the cooldown. On the tick it crosses 0, signal the
  // engine to spawn a fireball + reset the cooldown for the next shot. We
  // also REQUIRE dist > 0 so a degenerate overlap doesn't divide-by-zero
  // when the engine computes the projectile direction.
  if (ranged && enemy.state === "attacking" && dist > 0) {
    if (enemy.rangedCooldown > 0) {
      enemy.rangedCooldown -= 1;
    }
    if (enemy.rangedCooldown <= 0) {
      enemy.rangedCooldown = RANGED_COOLDOWN_TICKS;
      return true;
    }
  }

  // --- Movement ------------------------------------------------------------
  // Only chasing enemies move. Attacking enemies hold position. Idle enemies
  // are rooted by definition.
  if (enemy.state !== "chasing") return false;
  if (dist === 0) return false; // standing on the player; nothing to do

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

  return false;
}
