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
  /** Fixed-step frames remaining on the current hit-flash pulse (#166).
   *  Set to ENEMY_HIT_FLASH_TICKS the tick a player shot connects with
   *  this enemy; decremented each fixed-step AFTER the hitstop gate. The
   *  renderer reads this and bumps the body material's emissive toward
   *  white with intensity `hitFlashTicks / ENEMY_HIT_FLASH_TICKS`. 0 at
   *  rest — only enemies with hitFlashTicks>0 get the emissive bump. */
  hitFlashTicks: number;
  /** Fixed-step frames since this enemy died (#194). Set to 0 the tick
   *  the killing blow lands (state flips to 'dead'); incremented each
   *  fixed-step thereafter. The engine holds the corpse on the roster
   *  until `deathTicks >= CORPSE_HOLD_TICKS` (so the death pose READS
   *  for the full heavy-genre beat), and the renderer fades the body's
   *  material alpha from 1→0 over the last CORPSE_FADE_TICKS frames so
   *  the corpse dissolves rather than snaps. Undefined while alive —
   *  only set on the lethal damage branch. */
  deathTicks?: number;
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
 *  inventory + switching behind this single equipped slot.
 *
 *  Issue #87 adds two viewmodel/flash fields to the contract:
 *   - `muzzleFlashTicks` is the fixed-step frames remaining on the current
 *     muzzle-flash pulse. Set to MUZZLE_FLASH_TICKS the tick a shot is
 *     fired; counted down each fixed-step. >0 means the flash is showing
 *     this tick — the HUD / e2e harness assert on this rather than reading
 *     a pixel.
 *   - `viewmodelPresent` is a boot-time flag: `true` once the engine has
 *     built the first-person weapon viewmodel and parented it to the
 *     camera. Lets the harness verify the model exists without reaching
 *     into the three.js scene graph from Playwright. */
export interface Weapon {
  kind: string;
  ammo: number;
  /** Fixed-step frames remaining on the current muzzle-flash pulse (#87).
   *  0 at rest; pulsed to MUZZLE_FLASH_TICKS by every fire that consumes
   *  ammo, decremented each fixed-step. */
  muzzleFlashTicks: number;
  /** True once the viewmodel Group is built and parented to the camera
   *  (#87). Stable for the engine's lifetime. */
  viewmodelPresent: boolean;
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
  /** Fixed-step frames remaining on the current damage-flash pulse (#91).
   *  Set to HIT_FLASH_TICKS the tick the player takes damage; counted down
   *  each fixed-step. >0 means the red overlay is showing this tick — the
   *  HUD / e2e harness read this rather than a pixel. */
  hitFlashTicks: number;
  /** Fixed-step frames remaining on the current screen-shake pulse (#91).
   *  Set to SHAKE_TICKS the tick the player takes damage; counted down each
   *  fixed-step. While >0 the render pass perturbs the camera by a small
   *  deterministic offset; resting at 0 the camera sits at the player's
   *  eye unmodified. */
  shakeTicks: number;
  /** Fixed-step frames remaining on the current GIVING-damage hitstop
   *  pulse (#166). Clamped (NEVER `+=`) to HITSTOP_TICKS_ON_HIT each time a
   *  player shot connects. While >0, the top of update()'s playing block
   *  decrements this and SKIPS the move/AI/projectile/viewmodel passes —
   *  input still drains, the tick counter still advances, the renderer
   *  still draws so the spark + flash beats read during the freeze. */
  hitstopTicks: number;
  /** Fixed-step frames remaining on the current connect-shake pulse (#166).
   *  Parallel to shakeTicks (player-damage shake from #91); this one is the
   *  smaller "thump" the camera takes when YOUR shot lands on something.
   *  Clamped to HIT_SHAKE_TICKS on connect, decayed each fixed-step AFTER
   *  the hitstop gate. syncCamera() sums this on top of shakeTicks at half
   *  amplitude so the two feedback beats stay semantically separate. */
  hitShakeTicks: number;
  /** Fixed-step frames remaining on the current damage-wobble pulse (#205).
   *  Set to DAMAGE_WOBBLE_TICKS the tick the player takes damage; decayed
   *  each fixed-step AFTER the hitstop gate (same place as the other
   *  pulses). Parallel to shakeTicks (the hard damage shake), but slower
   *  and lower-amplitude — sells the "stumbled / dazed" linger after the
   *  initial THUNK. syncCamera() adds a horizontal sine sway whose
   *  envelope scales with damageWobbleTicks / DAMAGE_WOBBLE_TICKS.
   *  Clamped via Math.max — never `+=` — same as every other channel. */
  damageWobbleTicks: number;
  /** Fixed-step frames remaining on the current KILL-shake pulse (#194).
   *  Third shake channel, parallel to shakeTicks (player damage) and
   *  hitShakeTicks (connect). Set to KILL_SHAKE_TICKS when a player
   *  shot proves lethal; bigger amplitude than the connect shake to sell
   *  the "I killed it" weight Doom's heavy compact demands. Phase-shifted
   *  in syncCamera() so the three channels don't beat-frequency cancel
   *  when fired together. Clamped via Math.max — never `+=`. */
  killShakeTicks: number;
  /** Live impact-spark particles (#166). Each entry is one short-lived
   *  world-space spark spawned at a hit point; the renderer maps these to
   *  a pool of THREE.Mesh sprites by index, the simulation advances them
   *  each tick (gravity + lifetime), and entries with ticksLeft<=0 are
   *  pruned. Deterministic: spawn velocities come from a fixed offset
   *  table, never Math.random. */
  impactSparks: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    ticksLeft: number;
  }>;
  /** Fixed-step frames remaining on the current PICKUP-flash pulse (#230).
   *  Set to PICKUP_FLASH_TICKS the tick `applyPickup()` grants a pickup;
   *  decayed each fixed-step AFTER the hitstop gate (same place as every
   *  other channel — pickups don't arm hitstop themselves, but they must
   *  hang with the world if a concurrent damage/kill hitstop is alive).
   *  >0 means the HUD vignette is showing this tick and the matching stat
   *  readout is mid-scale-pop — the harness reads this rather than CSS.
   *  CLOBBERED on arm (NOT Math.max — kind cue is single-channel, see
   *  `pickupKindFlash`); a fresh grant always overrides residual flash. */
  pickupFlashTicks: number;
  /** Which pickup kind armed the current flash (#230). Read alongside
   *  `pickupFlashTicks` so the HUD knows which tint + which stat readout to
   *  scale. `null` whenever `pickupFlashTicks === 0`. Single-channel by
   *  design: if a health pickup arms the green vignette and the player
   *  immediately walks onto armor before the flash decays, the kind flips
   *  to 'armor' (the green vignette WOULD lie about the new grant). Math.max
   *  on the counter would compound durations across kinds; clobbering both
   *  counter + kind together keeps the cue truthful. */
  pickupKindFlash: "health" | "armor" | "ammo" | null;
  /** Live blood-spray drops (#194). Distinct from impactSparks: blood is
   *  KILL-ONLY (sparks fire on every connect), darker/larger/slower,
   *  gravity-driven (heavy chunks that fall, not weightless chips). Same
   *  shape + pool pattern as impactSparks — renderer mirrors entries to
   *  THREE.Mesh by index; simulation advances per tick (gravity +
   *  lifetime); entries with ticksLeft<=0 are pruned. Deterministic
   *  spawn jitter (fixed table, no Math.random) per the game's
   *  determinism contract. */
  bloodDrops: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    ticksLeft: number;
  }>;
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
  /** Restart the game after a terminal state (#91). Resets `status` to
   *  'ready', clears `score`, restores `health`/`armor`/`alive`, refills
   *  ammo, reseeds stage 1's enemies + pickups + doors, and clears
   *  projectiles + hits. Idempotent: calling restart at any time hard-resets
   *  the run, so the title-screen "press any key" path and the game-over
   *  "press R to restart" path share the same wire. Synchronous publish. */
  restart(): void;
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

/** Test-only scene-atmosphere contract (issue #88). The engine sets fog +
 *  multiple lights on its `THREE.Scene` at boot; this handle publishes a
 *  flat read-out so the e2e harness can assert atmosphere without
 *  reaching into the three.js graph from Playwright. The getters walk the
 *  scene each read so future light additions (or stage-specific lights)
 *  are reflected live. */
export interface DoomScene {
  /** True iff `scene.fog` is set (non-null). */
  readonly hasFog: boolean;
  /** Constructor flavor of `scene.fog`: 'Fog' for linear, 'FogExp2' for
   *  exponential, '' if no fog. Acceptance asserts 'Fog'. */
  readonly fogType: string;
  /** Count of Object3Ds in the scene where `isLight===true`. The
   *  acceptance criterion is `> 1`. */
  readonly lightCount: number;
}

/** Test-only audio contract (issue #89). The engine constructs a
 *  procedural-SFX engine at boot but defers AudioContext creation until
 *  the first user gesture (autoplay policy). After unlock the harness
 *  can assert that an AudioContext exists AND that fire/hit/pickup events
 *  bump the matching counter — proving each play* helper triggered a
 *  sound node, without listening to headless audio. */
export interface DoomAudio {
  /** True iff `unlock()` ran AND an AudioContext was created. */
  readonly unlocked: boolean;
  /** True iff an `AudioContext` instance exists on the engine. */
  readonly contextPresent: boolean;
  /** Monotonic count of weapon-shot sound nodes triggered. */
  readonly weaponShots: number;
  /** Monotonic count of enemy-hit sound nodes triggered. */
  readonly enemyHits: number;
  /** Monotonic count of enemy-death sound nodes triggered. */
  readonly enemyDeaths: number;
  /** Monotonic count of pickup sound nodes triggered. */
  readonly pickups: number;
}

/** Test-only viewmodel contract (issue #87). The engine builds a first-
 *  person weapon mesh and parents it to the camera at boot; this handle
 *  publishes whether the viewmodel exists AND whether its parent is the
 *  camera (so the harness can assert "fixed to the camera" without
 *  reaching into three.js). `childCount` is the leaf primitive count
 *  (grip + slide + barrel + sight + flash light + flash sprite) for a
 *  multi-mesh assertion mirroring `__doomModels`. */
export interface DoomViewmodel {
  /** True iff the engine constructed the viewmodel group at boot. */
  present: boolean;
  /** True iff the viewmodel's parent is the player camera. The whole point
   *  of #87 — "fixed to the camera" — is verified here. */
  parentIsCamera: boolean;
  /** Number of direct child meshes/lights on the viewmodel group. >1
   *  guards against a single-box placeholder slipping in. */
  childCount: number;
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
    /** Test-only viewmodel contract — see `DoomViewmodel` (issue #87). */
    __doomViewmodel?: DoomViewmodel;
    /** Test-only scene-atmosphere contract — see `DoomScene` (issue #88). */
    __doomScene?: DoomScene;
    /** Test-only audio contract — see `DoomAudio` (issue #89). */
    __doomAudio?: DoomAudio;
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

/** The weapon the player boots with — a pistol with a starting magazine.
 *  `muzzleFlashTicks` and `viewmodelPresent` start at their resting values;
 *  the engine flips `viewmodelPresent=true` once it has parented the
 *  viewmodel to the camera (issue #87). */
export const STARTING_WEAPON: Weapon = {
  kind: "pistol",
  ammo: 50,
  muzzleFlashTicks: 0,
  viewmodelPresent: false,
};

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
    hitFlashTicks: 0,
    shakeTicks: 0,
    hitstopTicks: 0,
    hitShakeTicks: 0,
    killShakeTicks: 0,
    damageWobbleTicks: 0,
    impactSparks: [],
    bloodDrops: [],
    pickupFlashTicks: 0,
    pickupKindFlash: null,
  };
}

/** Fixed-step frames a damage-flash pulse holds (#91). ~12 ticks @ 60Hz =
 *  200ms — long enough to read, short enough not to obscure play. */
export const HIT_FLASH_TICKS = 12;

/** Fixed-step frames a screen-shake pulse holds (#91). Same duration as the
 *  hit flash so the two read as one beat. */
export const SHAKE_TICKS = 12;

/** World-units of camera offset at peak shake (#91). Decays linearly with
 *  the tick counter so the perturbation fades smoothly. Small enough that
 *  the player doesn't feel motion-sick on every chip. */
export const SHAKE_AMPLITUDE = 0.08;

// --- Enemy-hit juice (#166) -------------------------------------------------
// The GIVING-damage side: visual feedback when YOUR shot connects with an
// enemy. Mirrors what #133 did for Galaga (bullet→enemy hit juice) and #150
// did for Pac-Man (ghost eat). Doom is HEAVY: punchier than Galaga's arcade
// pop, slower decay than Pac-Man's pickup pickup. Each landed shot is a
// meat-thunk — body flash + impact spark + brief hitstop + a small camera
// thump that's distinct from the recoil-on-fire kick (which lives on the
// viewmodel group, not the camera).

/** Fixed-step frames an enemy's hit-flash pulse holds. 6 ticks @ 60Hz =
 *  ~100ms — fast linear decay so the bright pop reads, then is gone before
 *  the next shot. The renderer reads `enemy.hitFlashTicks / ENEMY_HIT_FLASH_TICKS`
 *  as a [0..1] emissive bump factor toward white. */
export const ENEMY_HIT_FLASH_TICKS = 6;

/** Fixed-step frames the global hitstop holds on every landed shot (#166).
 *  2 ticks @ 60Hz = ~33ms — barely a flicker but enough that the player
 *  FEELS the impact register. CLAMPED via Math.max (never `+=`) so a future
 *  multi-pellet shotgun can't stack itself into a frozen engine. */
export const HITSTOP_TICKS_ON_HIT = 2;

/** Fixed-step frames the connect-shake holds on every landed shot (#166).
 *  3 ticks @ 60Hz = ~50ms. Parallel to player-damage `shakeTicks` (#91) so
 *  the two beats stay distinct — this one is the smaller thump of YOUR shot
 *  finding meat, the other is your own body taking a hit. */
export const HIT_SHAKE_TICKS = 3;

/** Camera-offset scale for the connect-shake, relative to SHAKE_AMPLITUDE.
 *  Half-amplitude — softer than the damage shake so the player can still
 *  tell the two apart on feel alone. */
export const HIT_SHAKE_AMPLITUDE_FACTOR = 0.5;

/** Number of impact sparks spawned per landed shot (#166). 6 is dense
 *  enough to read as a burst without flooding the scene or running the
 *  pool dry on rapid-fire. */
export const IMPACT_SPARK_COUNT = 6;

/** Fixed-step frames each impact spark lives (#166). 18 ticks @ 60Hz =
 *  ~300ms — long enough to arc, short enough that even sustained fire
 *  caps the live spark pool. Per-tick: position += velocity; vy -= 0.005
 *  (gravity); scale shrinks toward 0 linearly. */
export const IMPACT_SPARK_LIFETIME = 18;

/** Flinch-knock distance (world units) on a non-lethal hit (#166). The
 *  enemy is pushed along the shot direction by this much, capped against
 *  `collidesAt` so it doesn't tunnel through walls. Skipped on lethal —
 *  the death clip owns that beat. */
export const ENEMY_FLINCH_KNOCK = 0.08;

// --- Enemy-death amplification (#194) --------------------------------------
// Doom = HEAVY. Per Diego's tone rule (pacman=graceful, galaga=punchy,
// doom=HEAVY), the killing blow needs its own bigger beat above and beyond
// #166's universal connect juice: longer hitstop, a SECOND parallel shake
// that's bigger than the connect one, a blood spray distinct from the orange
// impact sparks, and a corpse beat that holds the body down before fade.

/** Fixed-step frames hitstop holds on a KILL (#194). 6 ticks @ 60Hz = 100ms
 *  — three times HITSTOP_TICKS_ON_HIT (2). The kill freeze re-uses the
 *  existing hitstop gate in update() so no new wiring; we just clamp the
 *  channel UP. Clamped via Math.max — never `+=` — past Galaga learning
 *  that cumulative juice freezes the sim forever. */
export const KILL_HITSTOP_TICKS = 6;

/** Fixed-step frames the kill-shake channel holds (#194). 14 ticks @ 60Hz
 *  = ~233ms — readably longer than HIT_SHAKE_TICKS (3). syncCamera()
 *  applies a (k^2) envelope so the punch hits hard up front and settles
 *  fast, NOT a flat decay that would feel mushy. */
export const KILL_SHAKE_TICKS = 14;

/** Camera-offset scale for the kill-shake, relative to SHAKE_AMPLITUDE.
 *  1.6× — bigger than the player-damage shake's 1.0 and well above the
 *  connect shake's 0.5. The killing blow is the loudest tactile beat. */
export const KILL_SHAKE_AMPLITUDE_FACTOR = 1.6;

/** Number of blood drops spawned on the killing blow (#194). 14 — more
 *  than IMPACT_SPARK_COUNT (6) so the kill burst reads as denser/wetter.
 *  Capped at the JITTER table length in spawnBloodSpray. */
export const BLOOD_DROP_COUNT = 14;

/** Fixed-step frames each blood drop lives (#194). 32 ticks @ 60Hz =
 *  ~533ms — longer than sparks (18) so the drops have time to arc + fall. */
export const BLOOD_DROP_LIFETIME = 32;

/** Base velocity scale for a blood drop along the spawn jitter direction
 *  (#194). ~62% of the spark base — heavier matter, slower throw. */
export const BLOOD_DROP_SPEED = 0.05;

/** Gravity applied per fixed-step to each blood drop's vy (#194). 2.4×
 *  spark gravity (0.005) — blood is HEAVY and falls fast, not the
 *  near-weightless drift of spark chips. */
export const BLOOD_DROP_GRAVITY = 0.012;

/** World-space sphere radius for a blood-drop mesh (#194). 50% larger
 *  than a spark (0.04) so the drops read as chunks, not chips. */
export const BLOOD_DROP_SIZE = 0.06;

/** Tint for blood drops (#194) — dark blood red. Reads against the
 *  corridor's dim warm palette without going cartoon-bright. */
export const BLOOD_DROP_COLOR = 0x882222;

/** Fixed-step frames a dead enemy stays on the roster before cull (#194).
 *  24 ticks @ 60Hz = 400ms total. The death pose holds, then the renderer
 *  fades alpha over the last CORPSE_FADE_TICKS frames before the engine
 *  drops the model. Heavy genre = the body LANDS, not flickers and gone. */
export const CORPSE_HOLD_TICKS = 24;

/** Tick within the corpse beat at which alpha-fade begins (#194). Frames
 *  CORPSE_FADE_START_TICK..CORPSE_HOLD_TICKS map to alpha 1→0 linearly.
 *  The first 12 ticks hold full opacity (the LAND); the last 12 fade. */
export const CORPSE_FADE_START_TICK = 12;

// --- Player-damage feel polish (#205) -------------------------------------
// Doom = HEAVY (per tone rule: pacman=graceful, galaga=punchy, doom=HEAVY).
// Taking a hit should THUNK and LINGER — the inverse of #194's kill thunk.
// Three concurrent additions on the damage edge, all additive on top of
// #91's existing flash/shake:
//   1. Damage hitstop — 3-frame freeze on every damage event.
//   2. Exponential flash decay — replace the HUD's linear alpha with ×0.85
//      per tick from peak (sharp bite up front, tail down to ~10%).
//   3. Lingering wobble — slow horizontal sine sway (~0.3 Hz, 0.3× shake
//      amplitude) over 30 ticks (~500ms) sells the daze.
// Channel phase rates are chosen distinct from #91's damage shake (1.7/2.3),
// #166's connect shake (2.1/1.9), and #194's kill shake (1.3/1.7), so all
// four channels live together without beat-cancellation.

/** Fixed-step frames hitstop holds on player damage (#205). 3 ticks @ 60Hz
 *  = ~50ms — HALF the KILL_HITSTOP_TICKS (6) on purpose: a kill is the
 *  player's victory thunk, a hit is the world's; the kill should be
 *  heavier. Same Math.max clamp pattern as #194 (NEVER `+=`). */
export const DAMAGE_HITSTOP_TICKS = 3;

/** Fixed-step frames the damage-wobble channel holds (#205). 30 ticks @
 *  60Hz = ~500ms — long enough that a single hit reads as "dazed for
 *  half a second", short enough not to overstay. Linear amp decay (kw =
 *  ticks / DAMAGE_WOBBLE_TICKS) — the LINGER, not the punch. */
export const DAMAGE_WOBBLE_TICKS = 30;

/** Per-tick phase step for the damage-wobble sine (#205). 0.0314 rad/tick
 *  ≈ 0.3 Hz at 60 ticks/s — a slow horizontal sway, distinct from the
 *  ~2-rad/tick high-frequency wiggle of the hard shakes. Name mirrors the
 *  spec doc (doom/docs/juice/player-damage-205.md) — code and contract
 *  agree on `_PHASE_RATE`. */
export const DAMAGE_WOBBLE_PHASE_RATE = 0.0314;

/** Camera-offset scale for the wobble, relative to SHAKE_AMPLITUDE (#205).
 *  0.3 — gentle. The wobble is the LINGER after the THUNK, not a second
 *  thunk; it should READ but not compete with the hard damage shake's
 *  initial amplitude. Horizontal-only (no oy term) so it sells "stumbled
 *  sideways", not "head-bobbing". Name mirrors the spec doc — code and
 *  contract agree on `_AMPLITUDE_FACTOR`. */
export const DAMAGE_WOBBLE_AMPLITUDE_FACTOR = 0.3;

/** Exponential flash decay base (#205). The HUD overlay's alpha at tick
 *  `t` (where t = HIT_FLASH_TICKS - hitFlashTicks, i.e. ticks elapsed
 *  since peak) is `DAMAGE_FLASH_DECAY ^ t`. At 0.85: tick 1 ≈ 0.85, tick
 *  6 ≈ 0.38, tick 12 ≈ 0.14 — sharp bite up front, exponential tail.
 *  Inverse envelope of the prior linear fade. */
export const DAMAGE_FLASH_DECAY = 0.85;

// --- Pickup feel (#230) ---------------------------------------------------
// The AFFIRMATIVE beat in Doom's emotional set. #166 = connect, #194 = kill,
// #205 = take-damage; pickup is the corridor's gift — HEAVY-AFFIRMATIVE, not
// punchy. Generous window (slower than damage flash), tinted vignette
// distinguishing kind, and a confident scale-pop on the matching stat
// readout. No hitstop (a gift shouldn't interrupt the world's beat).

/** Fixed-step frames a pickup-flash pulse holds. 24 ticks @ 60Hz = 400ms —
 *  longer than HIT_FLASH_TICKS (12) so the affirmative beat OUTLASTS the
 *  damage beat. The HUD reads `pickupFlashTicks / PICKUP_FLASH_TICKS` as
 *  a [0..1] envelope for both the vignette alpha and the stat-pop scale. */
export const PICKUP_FLASH_TICKS = 24;

/** Exponential decay base for the pickup vignette's alpha (#230). At
 *  0.88: tick 1 ≈ 0.88, tick 12 ≈ 0.22 — slower decay than the damage
 *  flash (0.85) so the gift's afterglow lingers. The HUD overlay's
 *  alpha at tick `t` (where t = PICKUP_FLASH_TICKS - pickupFlashTicks)
 *  is `PICKUP_FLASH_DECAY_PER_TICK ^ t * 0.35` — 0.35 keeps the vignette
 *  generous-but-readable; the corridor isn't obscured. */
export const PICKUP_FLASH_DECAY_PER_TICK = 0.88;

/** Apex of the matching stat readout's scale-pop (#230). 1.18 — a small
 *  confident bump, not a wobble. Linear ramp UP from 1.0 to this value
 *  over PICKUP_STAT_POP_PEAK_TICK ticks, then exponential return to 1.0
 *  over the remaining ticks. Reads as "this number just MATTERED". */
export const PICKUP_STAT_POP_PEAK = 1.18;

/** Tick within the flash window where the stat-pop reaches peak (#230).
 *  6 ticks @ 60Hz = 100ms — the THUNK; the remaining 18 ticks are the
 *  exponential glide back to 1.0. */
export const PICKUP_STAT_POP_PEAK_TICK = 6;

/** Per-tick decay base for the stat-pop's POST-PEAK glide (#230). 0.82
 *  per tick — over the 18 post-peak ticks the bump glides smoothly back
 *  to ~1.0 (0.82^18 ≈ 0.029, multiplied by the 0.18 peak amplitude). */
export const PICKUP_STAT_POP_DECAY = 0.82;

/** Per-kind vignette tint (#230). Each pickup kind gets its own color so
 *  the player reads the GIFT at a glance:
 *    health = green (restore)
 *    armor  = cool blue (protect)
 *    ammo   = amber (power)
 *  Hex strings to match the rest of the HUD's color choices (index.html
 *  uses #ff6a6a / #6ab0ff / #f0c674 for the matching cells). */
export const PICKUP_KIND_TINT: Record<"health" | "armor" | "ammo", string> = {
  health: "#3aff7a",
  armor: "#6ab4ff",
  ammo: "#ffd24a",
};
