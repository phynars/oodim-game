// The Doom state contract (load-bearing). `window.__doom` mirrors `DoomState`,
// and doom/e2e/doom.spec.ts asserts on it — that's how we verify the game
// *plays*, not just compiles (the same "CI for gameplay" gate Pac-Man and
// Galaga use, see ../../README.md + docs/ARCHITECTURE.md).
//
// Doom is the studio's FIRST true-3D project: a first-person shooter built on
// three.js + WebGL rather than the 2D canvas the other two products use. The
// camera IS the player — its position + orientation are the player's body and
// gaze. Everything else (enemies, projectiles, pickups, doors) is published
// here in WORLD coordinates so the e2e harness can assert gameplay state
// without ever touching a pixel (WebGL pixels are unreadable in headless CI —
// see docs/ARCHITECTURE.md "WebGL in headless CI").
//
// This file is intentionally the WHOLE contract for the full-FPS scope (combat,
// health/armor, multiple enemy archetypes, projectiles, pickups, doors,
// weapons) even though the scaffold only fills in the boot/loop fields plus a
// seeded enemy roster. Backlog slices flesh out the behavior behind these
// fields; they must NEVER remove a field a test depends on — add fields as
// mechanics land, deprecate by leaving them stable.

// Arena footprint comes from the level map (level.ts) so state.field + the
// floor mesh stay in sync. The #75 level-map slice introduced these and renamed
// the old FIELD_WIDTH/FIELD_HEIGHT, but left initialState() referencing the old
// names — a tsc break on main (2026-06-19). level.ts does not import types, so
// this is not circular.
import { MAP_WIDTH, MAP_HEIGHT } from "./level";

/** High-level lifecycle. Boots to 'ready'; first input flips to 'playing'.
 *  'won' = level cleared; 'lost'/'gameover' = the player died (two-step
 *  terminal, mirroring Galaga: 'lost' is the immediate death flip, 'gameover'
 *  the settled terminal state once the death beat has read). */
export type DoomStatus = "ready" | "playing" | "won" | "lost" | "gameover";

/** The player. The camera IS the player — `x/y/z` is the eye position in world
 *  units and `yaw/pitch` is the look direction. There is no separate avatar
 *  mesh; you see through these eyes. Health/armor are the survival stats. */
export interface PlayerState {
  /** World-x of the eye (east/west). */
  x: number;
  /** World-y of the eye — the EYE HEIGHT above the floor (the player's
   *  "head"). Constant while walking; the floor plane sits at y=0. */
  y: number;
  /** World-z of the eye (north/south). */
  z: number;
  /** Look heading in radians (rotation about the world-up axis). 0 looks
   *  down -z; increases turning left. */
  yaw: number;
  /** Look elevation in radians (up/down tilt). 0 is level; clamped to roughly
   *  ±π/2 so the view never flips over. */
  pitch: number;
  /** Hit points. Starts at PLAYER_START_HEALTH (100); at 0 the player dies
   *  (alive=false → status flips to a terminal state). */
  health: number;
  /** Armor points. Absorbs a fraction of incoming damage before health.
   *  Starts at PLAYER_START_ARMOR (0); raised by armor pickups. */
  armor: number;
  /** False once health hits 0. The death/respawn lifecycle lives behind this
   *  flag (the scaffold just flips it; respawn vs gameover is a backlog
   *  slice). */
  alive: boolean;
}

/** Doom's enemy archetypes. ORIGINAL / GENERIC names — deliberately NOT id
 *  Software's trademarked monster names or assets. 'imp' = fast weak grunt,
 *  'demon' = a melee bruiser, 'baron' = a heavy ranged boss. */
export type EnemyKind = "imp" | "demon" | "baron";

/** Where an enemy is in its AI lifecycle. 'idle' = unaware, holding position;
 *  'chasing' = has seen the player and is pathing toward them; 'attacking' =
 *  in range and dealing damage; 'dead' = killed (kept on the roster for one
 *  death-frame, then culled by the engine). */
export type EnemyState = "idle" | "chasing" | "attacking" | "dead";

export interface Enemy {
  /** Stable per-spawn id (lets the renderer + tests track an individual). */
  id: number;
  kind: EnemyKind;
  /** World-space position. `y` is the enemy's base/foot height (floor=0). */
  x: number;
  y: number;
  z: number;
  /** Hit points remaining. At <=0 the engine flips `state` to 'dead'. */
  hp: number;
  state: EnemyState;
  /** Fixed-step frames remaining until this enemy can land its NEXT melee
   *  hit on the player (#79). Counted down each tick while in 'attacking'
   *  state; on 0, the engine applies ATTACK_DAMAGE_BY_KIND and resets the
   *  cooldown. Starts at 0 so the first in-range tick lands a hit. */
  attackCooldown: number;
}

/** A projectile in flight. `from` distinguishes the player's shots from enemy
 *  fire so collision + scoring can tell them apart. Positions are world-space;
 *  `vx`/`vz` are world units per fixed-step (60 Hz). `damage` is applied to
 *  whatever the projectile hits (a player for `from:'enemy'`, an enemy for
 *  `from:'player'`). The engine advances + collision-tests these each tick. */
export interface Projectile {
  /** Stable per-spawn id (lets the renderer + tests track an individual). */
  id: number;
  x: number;
  y: number;
  z: number;
  /** Floor-plane velocity, world units per fixed-step. Projectiles travel in
   *  a straight line at constant speed — no gravity, no homing. */
  vx: number;
  vz: number;
  /** Damage dealt on contact. */
  damage: number;
  from: "player" | "enemy";
}

/** A floor pickup. Walking over an un-taken pickup applies its effect (health
 *  restores hp, armor adds armor, ammo refills the weapon) and flips
 *  `taken=true`. Positions are floor-plane (x,z); height is implied. */
export interface Pickup {
  id: number;
  kind: "health" | "armor" | "ammo";
  x: number;
  z: number;
  taken: boolean;
}

/** A door in the level. `open` toggles as the player approaches / triggers it;
 *  the renderer slides the door mesh based on this flag. Positions are
 *  floor-plane (x,z). */
export interface DoorState {
  id: number;
  x: number;
  z: number;
  open: boolean;
}

/** The currently-equipped weapon. `kind` is a free-form id (e.g. 'pistol');
 *  `ammo` is rounds remaining for that weapon. The backlog adds a weapon
 *  inventory + switching behind this single equipped slot. */
export interface Weapon {
  kind: string;
  ammo: number;
}

/** A landed hitscan-weapon hit, published on the contract so the death-slice
 *  + e2e harness can OBSERVE that a shot connected without inspecting WebGL
 *  pixels. `enemyId` is the Enemy.id the ray landed on; `tick` is state.tick
 *  at the moment of the hit (0 if fired from READY). The roster is
 *  append-only in the scaffold — the engine never trims it, so the harness
 *  can assert "a hit was recorded" without racing a cull. */
export interface Hit {
  enemyId: number;
  tick: number;
}

export interface DoomState {
  /** Lifecycle. Boots to 'ready'. */
  status: DoomStatus;
  /** Fixed-timestep counter. Increments once per `update()` while playing. */
  tick: number;
  /** Player score (kills, pickups, secrets). */
  score: number;
  /** Current level/stage number. Starts at 1. */
  stage: number;
  /** Level footprint in world units, published so HUD/test code can read the
   *  arena shape without importing the renderer. The floor plane spans
   *  `width × height` centered on the origin. */
  field: { width: number; height: number };
  /** The player (the camera). */
  player: PlayerState;
  /** Live enemy roster. The scaffold SEEDS a few so the contract is non-empty
   *  and `forceHit` has something to hit; backlog slices grow the spawn + AI. */
  enemies: Enemy[];
  /** Projectiles in flight (player + enemy). Empty until the firing slice
   *  lands. */
  projectiles: Projectile[];
  /** Floor pickups. Empty in the scaffold until the pickup slice lands (the
   *  `forcePickup` hook still works on whatever is present). */
  pickups: Pickup[];
  /** Doors in the level. Empty in the scaffold until the level-geometry slice
   *  lands. */
  doors: DoorState[];
  /** The currently-equipped weapon. */
  weapon: Weapon;
  /** Landed hits this run. The hitscan-fire slice (issue #76) appends one
   *  entry per shot that connects. Append-only in the scaffold; backlog may
   *  later cap or window it. */
  hits: Hit[];
}

/** Test-only escape hatches. The e2e harness can force deterministic combat
 *  outcomes (land a hit, take damage, grab a pickup) without having to align
 *  positions + aim through the simulation. Exposed on `window` alongside
 *  `__doom` so Playwright can drive them from page.evaluate.
 *
 *  Mirrors Galaga's GalagaInternals doc style — intentionally tiny, one method
 *  per outcome:
 *   - `forceHit` damages/kills the FIRST enemy (or `enemyId` if given) as if a
 *     player shot just landed; lethal damage flips that enemy to 'dead' and
 *     awards its score.
 *   - `forceDamage` reduces player health by `amount` (default a small chip);
 *     on LETHAL damage the player dies (alive=false) and `status` flips to a
 *     terminal state ('lost' → 'gameover').
 *   - `forcePickup` marks a pickup taken (the first un-taken one, or `id` if
 *     given) and APPLIES its effect (health/armor/ammo).
 *   - `advance` runs the fixed-step simulation `steps` times SYNCHRONOUSLY with
 *     a forced movement override, bypassing rAF + the wall clock entirely.
 *     This makes movement FRAME-RATE-INDEPENDENT for the harness — essential
 *     because Doom renders with WebGL, and under headless SwiftShader the rAF
 *     that drives the engine's fixed-step accumulator (engine.ts start()) fires
 *     far slower than 60Hz. A test that holds a key for a fixed wall-clock
 *     `waitForTimeout` therefore moves a NON-DETERMINISTIC, machine-dependent
 *     distance: green locally, far short in CI. `advance` instead steps the
 *     sim a known number of times, so travel = steps × PLAYER_SPEED_PER_TICK is
 *     exact regardless of render cadence. It mirrors Galaga's
 *     deterministic-internals philosophy. The forced input feeds the SAME input
 *     path real `update()` reads (the per-tick snapshot), so movement +
 *     wall-collision clamping run identically to live play. Test-only: gameplay
 *     code must NEVER call it.
 *   - `fire` triggers ONE hitscan shot SYNCHRONOUSLY from the current camera
 *     pose, going through the same path Space does (consume ammo, raycast,
 *     damage + score on hit, append to `hits`). Test-only; bypasses the input
 *     edge-trigger so the harness doesn't depend on rAF for ammo/hit timing. */
export interface DoomInternals {
  forceHit(opts?: { enemyId?: number }): void;
  forceDamage(opts?: { amount?: number }): void;
  forcePickup(opts?: { id?: number }): void;
  /** Step the fixed-step sim exactly `steps` times with the given movement
   *  keys forced held for the duration, then restore live input. `forward`/
   *  `back`/`left`/`right` map to the same forward/backward/strafe intents the
   *  keyboard produces. Synchronous + wall-clock-free — see the doc above. */
  advance(opts: {
    steps: number;
    forward?: boolean;
    back?: boolean;
    left?: boolean;
    right?: boolean;
  }): void;
  /** Fire one hitscan shot from the current camera pose. Mirrors a Space
   *  press: decrements ammo (or no-ops at 0), raycasts against enemy meshes,
   *  damages the nearest hit + appends to `hits`. Synchronous publish. */
  fire(): void;
}

/** Test-only texture contract (issue #84). The engine paints procedural
 *  CanvasTextures into the wall/floor/ceiling materials at boot; this handle
 *  publishes whether the shared wall material's `map` is populated, so the
 *  e2e harness can assert the texture wiring without reaching into the
 *  three.js scene graph. */
export interface DoomTextures {
  /** True iff the shared wall material's `map` is a non-null Texture after
   *  engine construction. */
  wallMapPresent: boolean;
}

/** Test-only enemy-model contract (issue #85). The engine builds a low-poly
 *  `THREE.Group` per enemy out of merged primitives (see `models.ts`); this
 *  handle publishes the leaf-mesh count per enemy id so the e2e harness can
 *  assert each enemy's scene object is a multi-mesh Group (childCount > 1),
 *  not a single placeholder box — without reaching into the three.js scene
 *  graph from Playwright. The map is rebuilt each call so it stays in sync
 *  with the live roster (seeded models + stage reloads). */
export interface DoomModels {
  /** Read the current per-enemy child-mesh count. Returns one entry per
   *  live (non-dead) enemy: `{ enemyId, kind, childCount, clipNames,
   *  activeClip }`. `clipNames` is the list of animation clip names on the
   *  enemy's `AnimationMixer` (issue #86 — always `['idle','walk','attack',
   *  'death']` for now); `activeClip` is the name of the clip currently
   *  playing, which the engine swaps when `enemy.state` changes. */
  list(): Array<{
    enemyId: number;
    kind: EnemyKind;
    childCount: number;
    clipNames: string[];
    activeClip: string;
  }>;
}

declare global {
  interface Window {
    /** Test contract. See doom/docs/ARCHITECTURE.md. */
    __doom?: DoomState;
    /** Test-only combat hooks — see `DoomInternals`. */
    __doomInternals?: DoomInternals;
    /** Test-only texture contract — see `DoomTextures` (issue #84). */
    __doomTextures?: DoomTextures;
    /** Test-only enemy-model contract — see `DoomModels` (issue #85). */
    __doomModels?: DoomModels;
  }
}

/** Point values per archetype. Imps are grunts, demons tougher, barons the
 *  heavy payoff. Round numbers in the arcade spirit. */
export const SCORE_BY_KIND: Record<EnemyKind, number> = {
  imp: 100,
  demon: 250,
  baron: 1000,
};

/** Starting hit points per archetype. The backlog tunes these; the scaffold
 *  seeds the roster from this table so `forceHit` deals meaningful damage. */
export const HP_BY_KIND: Record<EnemyKind, number> = {
  imp: 30,
  demon: 80,
  baron: 200,
};

/** Damage one `forceHit` (or one player shot) deals. Larger than an imp's hp
 *  so a single `forceHit()` is lethal to the seeded imp — the e2e harness
 *  asserts forceHit() drops the first enemy to 'dead'. */
export const PLAYER_SHOT_DAMAGE = 50;

/** Eye height above the floor, in world units (~1.6 = a standing human in
 *  meters). The camera sits here; the floor plane is at y=0. */
export const EYE_HEIGHT = 1.6;

/** Player starting survival stats. */
export const PLAYER_START_HEALTH = 100;
export const PLAYER_START_ARMOR = 0;

/** The weapon the player boots with — a pistol with a starting magazine. */
export const STARTING_WEAPON: Weapon = { kind: "pistol", ammo: 50 };

/** Canonical initial state. The engine seeds `window.__doom` from this, then
 *  layers the seeded enemy roster on top (see engine.ts seedEnemies()). */
export function initialState(): DoomState {
  return {
    status: "ready",
    tick: 0,
    score: 0,
    stage: 1,
    field: { width: MAP_WIDTH, height: MAP_HEIGHT },
    player: {
      // Stand at the south edge looking north (down -z) into the arena.
      x: 0,
      y: EYE_HEIGHT,
      z: MAP_HEIGHT / 2 - 4,
      yaw: 0,
      pitch: 0,
      health: PLAYER_START_HEALTH,
      armor: PLAYER_START_ARMOR,
      alive: true,
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    doors: [],
    weapon: { ...STARTING_WEAPON },
    hits: [],
  };
}
