// Doom engine — SCAFFOLD. Deliberately minimal: it stands up a three.js / WebGL
// scene (floor + lights + placeholder enemy boxes), runs a fixed-step game loop
// DECOUPLED from rendering, and publishes the `window.__doom` state contract. It
// boots to 'ready' and flips to 'playing' on first input (so the e2e harness can
// prove the loop ticks AND that WebGL initialized in headless Chromium).
//
// Everything that IS the game — first-person movement, weapon firing +
// projectiles, enemy AI (idle→chasing→attacking), collision/damage/health,
// pickups, doors, level geometry, scoring/stages, win/lose — is the AUTONOMOUS
// BACKLOG (see doom/docs/ARCHITECTURE.md). This file is the floor the studio
// builds up from, mirroring how Pac-Man and Galaga started from a loop + a
// minimal world.
//
// three.js is imported as a namespace per the library's ESM convention.
import * as THREE from "three";

import {
  BLOOD_DROP_COLOR,
  BLOOD_DROP_COUNT,
  BLOOD_DROP_GRAVITY,
  BLOOD_DROP_LIFETIME,
  BLOOD_DROP_SIZE,
  BLOOD_DROP_SPEED,
  CORPSE_HOLD_TICKS,
  corpseFadeAlpha,
  DAMAGE_HITSTOP_TICKS,
  DAMAGE_WOBBLE_AMPLITUDE_FACTOR,
  DAMAGE_WOBBLE_PHASE_RATE,
  DAMAGE_WOBBLE_TICKS,
  ENEMY_FLINCH_KNOCK,
  ENEMY_HIT_FLASH_TICKS,
  HIT_FLASH_TICKS,
  HIT_SHAKE_AMPLITUDE_FACTOR,
  HIT_SHAKE_TICKS,
  HITSTOP_TICKS_ON_HIT,
  HP_BY_KIND,
  IMPACT_SPARK_COUNT,
  IMPACT_SPARK_LIFETIME,
  initialState,
  KILL_HITSTOP_TICKS,
  KILL_SHAKE_AMPLITUDE_FACTOR,
  KILL_SHAKE_TICKS,
  PICKUP_FLASH_TICKS,
  PICKUP_MESSAGES,
  PLAYER_SHOT_DAMAGE,
  SCORE_BY_KIND,
  SHAKE_AMPLITUDE,
  SHAKE_TICKS,
  type DoomState,
  type Enemy,
  type EnemyKind,
  type FrameProbeSample,
  type Projectile,
} from "./types";
// Note: EnemyKind kept above for the SEED_ENEMIES literal type.
import {
  createKeyboardInput,
  MOUSE_SENSITIVITY,
  PITCH_LIMIT,
  PLAYER_RADIUS,
  PLAYER_SPEED_PER_TICK,
  PLAYER_TURN_PER_TICK,
  type InputSnapshot,
  type InputSource,
} from "./input";
import {
  CELL,
  collidesAt,
  doors as levelDoors,
  exits as levelExits,
  findSpawn,
  loadStage,
  MAP_HEIGHT,
  MAP_WIDTH,
  setOpenDoors,
  TOTAL_STAGES,
  WALL_HEIGHT,
  walls,
  worldToCell,
} from "./level";
import {
  PROJECTILE_DAMAGE,
  PROJECTILE_HIT_RADIUS,
  PROJECTILE_SPEED_PER_TICK,
  stepEnemyAI,
} from "./enemy";
import {
  makeCeilingTexture,
  makeFloorTexture,
  makeWallTexture,
} from "./textures";
import {
  buildEnemyAnimations,
  buildEnemyModel,
  clipNameForState,
  disposeEnemyModel,
  ENEMY_MODEL_SIZE,
  setActiveClip,
  type EnemyAnimationRig,
} from "./models";
import {
  buildViewmodel,
  pulseMuzzleFlash,
  stepViewmodel,
  type Viewmodel,
} from "./viewmodel";
import { DoomAudio } from "./audio";

/** Fixed timestep: 60 logical updates/sec, decoupled from render rAF. The
 *  simulation advances in whole STEP_MS chunks via an accumulator so game
 *  logic is deterministic regardless of display refresh rate. */
const STEP_MS = 1000 / 60;

/** Ring-buffer capacity for the render-time probe (#237). 240 samples =
 *  4 s @ 60 Hz — long enough for the merge-gate spec (2 s sweep + warmup)
 *  to read a steady-state window without the front of the ring rolling
 *  off, short enough that the snapshot copy on `frameProbe()` is cheap.
 *  Preallocated in the engine ctor so the per-frame write is in-place
 *  (no GC pressure on the render path). */
const FRAME_PROBE_CAPACITY = 240;

/** Fixed-step frames the engine holds in the 'lost' state before advancing to
 *  'gameover'. ~0.5s at 60Hz — long enough that the death beat reads, short
 *  enough the terminal state doesn't feel delayed (mirrors Galaga). */
const GAMEOVER_HOLD_FRAMES = 30;

/** Camera field of view (degrees) + near/far planes. A 75° FOV is the classic
 *  FPS feel; the far plane comfortably covers the arena diagonal. */
const CAMERA_FOV = 75;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;

/** The seeded enemy roster for the scaffold. The full game spawns + paths
 *  these via AI (backlog); here we just place a few so the contract is
 *  non-empty and `forceHit` has something to hit. World-space positions are
 *  scattered across the arena's north half, in front of the player's spawn.
 *  The FIRST entry is an imp whose hp (30) is below PLAYER_SHOT_DAMAGE (50),
 *  so a single forceHit() drops it to 'dead' — the e2e harness asserts that. */
// Positions are world-space, chosen to land inside walkable cells of LEVEL_MAP
// (the map is centered on origin: x ∈ ±MAP_WIDTH/2, z ∈ ±MAP_HEIGHT/2). All
// three sit north of the south-central spawn so the player sees them
// immediately, and clear of the interior pillar at (1, 5).
const SEED_ENEMIES: ReadonlyArray<{ kind: EnemyKind; x: number; z: number }> = [
  { kind: "imp", x: -5, z: -3 },
  { kind: "demon", x: 5, z: -3 },
  { kind: "baron", x: -1, z: -7 },
];

/** Seed pickups for the scaffold. One of each kind, scattered on walkable
 *  floor cells (away from walls and the interior pillar). World-space (x, z).
 *  The engine seeds these so forcePickup() has something to take and a player
 *  walking the arena will eventually step on one. The FIRST entry is a health
 *  pickup — the e2e harness asserts forcePickup() (no id) takes it. */
const SEED_PICKUPS: ReadonlyArray<{
  kind: "health" | "armor" | "ammo";
  x: number;
  z: number;
}> = [
  { kind: "health", x: -3, z: 5 },
  { kind: "armor", x: 3, z: 5 },
  { kind: "ammo", x: 0, z: 3 },
];

/** Walk-over pickup radius in world units. A pickup is grabbed when the
 *  player's center sits within this distance of it. Slightly larger than
 *  PLAYER_RADIUS (0.3) so the player doesn't have to thread the needle. */
const PICKUP_RADIUS = 0.8;

/** Proximity radius for a door to flip OPEN (world units). When the player's
 *  center is within DOOR_OPEN_RADIUS of a door cell's center, the door's
 *  `open` flag flips true and collision starts treating that cell as floor.
 *  Larger than a CELL so the door opens BEFORE the player walks into it
 *  (otherwise the player would clip into a closed door for one tick). */
const DOOR_OPEN_RADIUS = CELL * 1.25;

// Enemy visual size + color used to live here as flat boxes. Issue #85
// replaced that with code-built low-poly models — see models.ts (one Group
// of merged primitives per kind). The sizing constant moved to
// ENEMY_MODEL_SIZE there; combat still uses HP_BY_KIND.

export class Engine {
  private readonly canvas: HTMLCanvasElement;
  private state: DoomState;
  private readonly input: InputSource;

  // three.js objects. The renderer draws the scene through the camera each
  // rAF; the simulation never touches these except to mirror enemy positions
  // onto their meshes for rendering.
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  /** Per-enemy model, keyed by enemy id — so the render pass can sync the
   *  group's transform to the simulation's enemy position + cull dead ones.
   *  Each value is a `THREE.Group` built by models.ts (issue #85): a
   *  multi-mesh low-poly silhouette, not a single box. */
  private readonly enemyMeshes: Map<number, THREE.Group> = new Map();
  /** Per-enemy animation rig (issue #86) — `AnimationMixer` + named clips
   *  built procedurally by models.ts. Advanced each render via
   *  `mixer.update(dt)` and switched whenever the enemy's `state` changes.
   *  Parallel-keyed with `enemyMeshes` (same enemy id). */
  private readonly enemyRigs: Map<number, EnemyAnimationRig> = new Map();
  /** Wall-clock source for animation deltas — `THREE.Clock` is the
   *  canonical wallclock helper. Used ONLY by the render pass to advance
   *  mixers; the SIMULATION's fixed-step loop is unaffected (mixers are
   *  presentation, not state). */
  private readonly animClock: THREE.Clock = new THREE.Clock();
  /** Reused raycaster for hitscan fire. One instance avoids per-shot
   *  allocations; the origin + direction are set per call. */
  private readonly raycaster: THREE.Raycaster = new THREE.Raycaster();

  /** Per-enemy snapshot of the body's resting emissive color (#166). The
   *  hit-flash render pass multiplies the material's emissive toward white
   *  by `hitFlashTicks / ENEMY_HIT_FLASH_TICKS`, then RESTORES to this
   *  baseline when the flash ends. Without snapshotting on first use, the
   *  flash would permanently brighten whatever color the model builder
   *  set (and a follow-up flash would compound). Map key is the leaf
   *  material's uuid so shared materials snapshot once. */
  private readonly emissiveBaselines: Map<string, THREE.Color> = new Map();

  /** Pool of impact-spark meshes (#166), parallel-indexed with
   *  state.impactSparks. Each entry is a small bright-orange emissive
   *  sphere positioned at the live spark's world coords each render. The
   *  pool grows on demand (push) when there are more sparks than meshes,
   *  and excess meshes are hidden (visible=false) rather than destroyed —
   *  rapid-fire reuses the same THREE.Mesh objects across bursts. */
  private readonly sparkMeshes: THREE.Mesh[] = [];

  /** Shared geometry + material for spark meshes (#166). Built lazily on
   *  first spawn so engine boot stays cheap; reused across every spark in
   *  the pool. The material is `MeshBasicMaterial` so the sparks ignore
   *  lighting + read full-bright through fog — a hit spark should pop
   *  against the dim corridor, not fade into it. */
  private sparkGeometry: THREE.SphereGeometry | null = null;
  private sparkMaterial: THREE.MeshBasicMaterial | null = null;

  /** Pool of blood-drop meshes (#194), parallel-indexed with
   *  state.bloodDrops. Mirrors sparkMeshes — distinct pool because the
   *  drops use a different (larger, dark-red) geometry/material and live
   *  on a different lifetime curve. Hidden meshes are kept for reuse. */
  private readonly bloodMeshes: THREE.Mesh[] = [];
  private bloodGeometry: THREE.SphereGeometry | null = null;
  private bloodMaterial: THREE.MeshBasicMaterial | null = null;

  /** First-person weapon viewmodel (#87). Built once at boot, parented to
   *  the camera so it inherits view transform automatically. The engine
   *  pulses its muzzle-flash on every shot and ticks its recoil/bob
   *  state once per fixed-step (so easing is deterministic). */
  private viewmodel: Viewmodel | null = null;

  /** Player-carried torch (#88). PointLight parented to the camera so it
   *  travels with the view — the immediate cells read warm + bright, the
   *  rest fades into fog. Constructed in the lighting block above; parented
   *  to the camera in the same step that attaches the viewmodel. */
  private playerTorch: THREE.PointLight | null = null;

  /** The shared wall material (issue #84). One MeshStandardMaterial is reused
   *  across every wall mesh; we stash a reference so the e2e harness can read
   *  the published texture contract without traversing the scene graph. */
  private wallMaterial: THREE.MeshStandardMaterial | null = null;

  /** Procedural SFX engine (#89). Constructed at boot, but the underlying
   *  AudioContext is deferred until first user gesture (autoplay policy).
   *  Every play* call is a silent no-op until `unlock()` runs. The engine
   *  routes fire / hit / death / pickup events through this so audio sits
   *  on the same edge the published state contract already does. */
  private readonly audio: DoomAudio = new DoomAudio();

  /** Preallocated render-time ring buffer (#237). FRAME_PROBE_CAPACITY
   *  entries, all mutable objects — the rAF loop writes into
   *  `frameProbeBuffer[frameProbeWrite % CAPACITY]` and increments. The
   *  per-frame cost is five number writes; nothing is allocated on the
   *  render path. `frameProbeWrite` is the MONOTONIC count of frames
   *  captured (not the ring index) — `frameProbe()` snapshots oldest→newest
   *  by walking from `max(0, write - CAPACITY)` forward. Test-only;
   *  gameplay reads nothing here. */
  private readonly frameProbeBuffer: FrameProbeSample[] = (() => {
    const out: FrameProbeSample[] = new Array(FRAME_PROBE_CAPACITY);
    for (let i = 0; i < FRAME_PROBE_CAPACITY; i++) {
      out[i] = { renderMs: 0, enemies: 0, sparks: 0, blood: 0, tick: 0 };
    }
    return out;
  })();
  private frameProbeWrite = 0;

  /** Stable id counter for projectiles (#81). Stamped onto each new
   *  Projectile and incremented — same monotonic scheme as enemies/pickups,
   *  so a test that tracks a projectile by id can. Instance-scoped so two
   *  engines on the same page wouldn't collide. */
  private nextProjectileId = 1;

  /** Cell coords for each entry in state.doors, parallel-indexed. The level
   *  map needs the cell coords to flip a cell's solidity, while the
   *  state.doors contract surface only carries world-space — this parallel
   *  array bridges the two without polluting the public type. */
  private doorCells: Array<{ col: number; row: number }> = [];

  /** Tick at which status flipped to 'lost'. After GAMEOVER_HOLD_FRAMES more
   *  fixed-step frames elapse the status advances to 'gameover'. Null while
   *  still playing (mirrors Galaga's two-step death). */
  private lostTick: number | null = null;
  /** Fixed-step frames accumulated since status flipped to 'lost'. Counted
   *  independently of state.tick because state.tick freezes once we leave
   *  'playing' (it's the in-game clock, not real time). */
  private gameOverFrames = 0;

  /** Player movement intent normalized to [0,1] (Diego juice ceiling #21).
   *  Set each tick in update()'s move block — 1 when any movement key is
   *  held, 0 when idle — and read by stepViewmodel() to couple weapon bob
   *  frequency + amplitude to motion. Reset to 0 whenever the sim isn't
   *  advancing (hitstop freeze, not 'playing') so the gun doesn't keep
   *  swaggering while the world is frozen. */
  private moveSpeedFrac = 0;

  // Fixed-step accumulator state (see start()).
  private lastTime = 0;
  private accumulator = 0;

  /** TEST-ONLY forced-input override. When non-null, update() reads movement
   *  from THIS snapshot instead of the live keyboard, letting the `advance`
   *  hook (see exposeInternals) drive deterministic, wall-clock-free movement.
   *  Always null during real play — gameplay code never sets it. */
  private forcedInput: InputSnapshot | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = initialState();

    // Level geometry drives spawn + footprint (issue #75). The map is the
    // source of truth — the prior hard-coded box-clamp is gone, collision now
    // queries level.ts cells. Spawn at the 'S' cell, looking north (down -z).
    const spawn = findSpawn();
    this.state.player.x = spawn.x;
    this.state.player.z = spawn.z;
    this.state.field = { width: MAP_WIDTH, height: MAP_HEIGHT };

    // --- three.js scene setup ---------------------------------------------
    // Renderer bound to the page's canvas. antialias:false keeps the headless
    // SwiftShader software path fast (and the e2e harness asserts on state,
    // never pixels, so MSAA buys nothing in CI). A dark clear color reads as
    // the dim corridors of the genre.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setClearColor(0x0a0a0f, 1);
    this.sizeRenderer();

    this.scene = new THREE.Scene();
    // ATMOSPHERE (issue #88): thicker fog rolls the far walls into murk and
    // hides the far plane pop-in. The near distance is short enough that a
    // wall two cells away already starts to fade — the corridor never feels
    // sterile. Color matches the clear color so the fog "dissolves" geometry
    // into the void rather than tinting it. Deterministic (literal constants,
    // no Math.random) + perf-sane (linear fog is one mul/add per fragment).
    this.scene.fog = new THREE.Fog(0x0a0a0f, 4, 28);

    // The camera IS the player. We position it at the player's eye each frame
    // (see syncCamera); construct it at the spawn so the very first rendered
    // frame already looks correct.
    const aspect =
      canvas.clientWidth > 0 && canvas.clientHeight > 0
        ? canvas.clientWidth / canvas.clientHeight
        : 16 / 9;
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      aspect,
      CAMERA_NEAR,
      CAMERA_FAR,
    );
    this.syncCamera();

    // LIGHTING (issue #88): replace the flat ambient+sun pair with a layered
    // rig that sells "dim corridors with hot spots". Five lights total:
    //   1. AMBIENT FILL — dimmer than the scaffold (0.35 vs 1.2) so corners
    //      genuinely darken; without this everything is washed flat.
    //   2. HEMISPHERE — cool ceiling / warm floor bounce. Cheap (no shadow
    //      pass) and gives the floor a different cast than the walls.
    //   3. DIRECTIONAL "sun" — kept for shape on enemy silhouettes, dimmer
    //      and tinted slightly cool to read as ambient skylight bleed.
    //   4. PLAYER TORCH — a PointLight parented to the camera (added below
    //      after camera-parent setup). Travels with the player so the
    //      immediate few cells read warm + bright, the rest fades into fog.
    //   5. ARENA SCONCE — a warm PointLight at the map center as a per-
    //      sector hot spot. Deterministic (literal position, no Math.random),
    //      per-fragment cost is constant in the fragment shader.
    // Each light is added to the scene so e2e can count > 1 light in the
    // graph (the acceptance criterion).
    this.scene.add(new THREE.AmbientLight(0x303040, 0.35));
    const hemi = new THREE.HemisphereLight(0x445566, 0x221a14, 0.45);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xb8c0d8, 0.4);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);
    // Arena sconce — warm point light at the map center, mounted high so it
    // pools light on the floor below. Range capped so its falloff lives
    // inside the fog distance (anything past the fog far is invisible
    // anyway; a smaller range is cheaper on the fragment shader).
    const sconce = new THREE.PointLight(0xff8844, 1.4, 14, 1.8);
    sconce.position.set(0, WALL_HEIGHT - 0.4, 0);
    this.scene.add(sconce);
    // Player torch — parented to the camera further down where we already
    // attach the viewmodel + camera to the scene; held aside so the
    // construction order stays linear.
    this.playerTorch = new THREE.PointLight(0xffb070, 1.1, 10, 1.6);
    // Slightly below + ahead of the eye so the torch reads as held, not as
    // a halo around the player's skull.
    this.playerTorch.position.set(0, -0.2, -0.3);

    // Floor — a plane spanning the arena, rotated flat (PlaneGeometry is built
    // in the XY plane; rotate -90° about X to lay it in XZ at y=0). Sized from
    // the level map so the floor exactly underlays the walkable cells.
    //
    // Issue #84: the surface materials carry a procedural CanvasTexture rather
    // than a flat color. Textures are painted into an offscreen canvas at
    // boot (no asset files ship), then tiled. Repeat is set so one painted
    // tile is roughly one world unit — flagstones on the floor, bricks on
    // the wall.
    const floorTex = makeFloorTexture();
    floorTex.repeat.set(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    const floorGeo = new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 1,
      metalness: 0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Ceiling — same plane, mirrored above the arena at WALL_HEIGHT. Its
    // texture is dimmer than the floor; the player rarely looks up so heavy
    // ceiling detail is wasted budget.
    const ceilingTex = makeCeilingTexture();
    ceilingTex.repeat.set(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: ceilingTex,
      roughness: 1,
      metalness: 0,
      // Render the under-side (toward the player); flip the normal.
      side: THREE.BackSide,
    });
    const ceiling = new THREE.Mesh(floorGeo.clone(), ceilingMat);
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    this.scene.add(ceiling);

    // Build wall meshes from the level map (issue #75). One box per solid
    // cell, sized CELL × WALL_HEIGHT × CELL, centered at the cell's world
    // position. Geometry + material are shared across walls — every solid
    // cell renders identically, and disposing them is a no-op for the scene
    // lifecycle (the engine outlives the level for now).
    //
    // Issue #84: walls carry a procedural brick CanvasTexture. The SAME
    // material is reused across every wall mesh (cheap, and reads as one
    // coherent surface). We hold a reference so the e2e harness can assert
    // the published texture contract — see `window.__doomTextures` below.
    const wallTex = makeWallTexture();
    const wallGeo = new THREE.BoxGeometry(2, WALL_HEIGHT, 2);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.9,
      metalness: 0,
    });
    this.wallMaterial = wallMat;
    for (const w of walls()) {
      const mesh = new THREE.Mesh(wallGeo, wallMat);
      mesh.position.set(w.x, WALL_HEIGHT / 2, w.z);
      this.scene.add(mesh);
    }

    // Seed the enemy roster + a placeholder box mesh per enemy.
    this.seedEnemies();

    // Seed the pickup roster.
    this.seedPickups();

    // Seed doors from the level map (#82). state.doors is the contract
    // surface; cell coords are stashed on a parallel array so the per-tick
    // proximity check can route them back into level.ts's open-cell cache.
    this.seedDoors();

    // First-person weapon viewmodel (#87). Built once, parented directly
    // onto the camera so it inherits the view transform — no per-frame
    // sync needed. The camera ITSELF must be in the scene graph for the
    // viewmodel to render (a PerspectiveCamera with attached children
    // renders its children only when the camera is part of the scene
    // being rendered); we add the camera to the scene here.
    const vm = buildViewmodel();
    this.camera.add(vm.group);
    // Player torch (#88): parent the torch to the camera so it inherits
    // view position. The camera itself is added to the scene immediately
    // below — same lifecycle as the viewmodel.
    if (this.playerTorch) this.camera.add(this.playerTorch);
    this.scene.add(this.camera);
    this.viewmodel = vm;
    this.state.weapon.viewmodelPresent = true;

    // Keyboard is the canonical input. First keydown flips ready→playing.
    this.input = createKeyboardInput();

    this.publish();
    this.bindInput();
    this.exposeInternals();
    this.exposeTextureHandle();
    this.exposeModelHandle();
    this.exposeViewmodelHandle();
    this.exposeSceneHandle();
    this.exposeAudioHandle();
  }

  /** Publish the audio contract to a test-only window handle (#89).
   *  Mirrors `__doomScene` / `__doomViewmodel`: live getters so the
   *  harness reads current counter values, not a snapshot. Test-only;
   *  gameplay code must never read this. */
  private exposeAudioHandle(): void {
    window.__doomAudio = this.audio.handle();
  }

  /** Publish the scene atmosphere state to a test-only window handle
   *  (issue #88). Lets the e2e harness assert that fog is set AND that
   *  more than one light exists, without traversing the three.js graph
   *  from Playwright. Mirrors the other __doom* handles — test-only,
   *  gameplay code must never read this. The accessor walks the scene
   *  on every read so future light additions (or stage-specific lights)
   *  reflect live. */
  private exposeSceneHandle(): void {
    const scene = this.scene;
    window.__doomScene = {
      get hasFog(): boolean {
        return Boolean(scene.fog);
      },
      get fogType(): string {
        const fog = scene.fog;
        if (!fog) return "";
        // Distinguish THREE.Fog (linear) from THREE.FogExp2 — both are
        // valid three.js fog flavors but only Fog carries near/far.
        return (fog as unknown as { isFogExp2?: boolean }).isFogExp2
          ? "FogExp2"
          : "Fog";
      },
      get lightCount(): number {
        let count = 0;
        scene.traverse((obj) => {
          if ((obj as { isLight?: boolean }).isLight) count += 1;
        });
        return count;
      },
    };
  }

  /** Publish the viewmodel contract to a test-only window handle (#87).
   *  Lets the e2e harness assert that the viewmodel was built AND that
   *  it's parented to the player camera, without traversing the three.js
   *  scene graph from Playwright. Mirrors __doomModels / __doomTextures:
   *  test-only, gameplay code must never read this. */
  private exposeViewmodelHandle(): void {
    const vm = this.viewmodel;
    window.__doomViewmodel = {
      present: vm !== null,
      parentIsCamera: vm !== null && vm.group.parent === this.camera,
      childCount: vm ? vm.group.children.length : 0,
    };
  }

  /** Publish the procedural-texture state to a test-only window handle
   *  (issue #84). Lets the e2e harness assert on the STATE CONTRACT — a wall
   *  material's `map` is non-null after engine boot — without traversing the
   *  three.js scene graph from Playwright. Mirrors `__doomInternals`: test-
   *  only, gameplay code must never read this. */
  private exposeTextureHandle(): void {
    window.__doomTextures = {
      wallMapPresent: this.wallMaterial?.map !== null && this.wallMaterial?.map !== undefined,
    };
  }

  /** Publish a live read of the per-enemy model child-mesh count (issue #85).
   *  Each enemy's scene object is a `THREE.Group` of merged primitives, so
   *  the harness can assert `childCount > 1` (vs. the prior single-box
   *  scaffold). `list()` walks the live roster on every call so the readout
   *  always matches the current scene — stage reloads, deaths, future
   *  spawns all reflected. Test-only; gameplay code must never read this. */
  private exposeModelHandle(): void {
    window.__doomModels = {
      list: () => {
        const out: Array<{
          enemyId: number;
          kind: EnemyKind;
          childCount: number;
          clipNames: string[];
          activeClip: string;
        }> = [];
        for (const enemy of this.state.enemies) {
          const model = this.enemyMeshes.get(enemy.id);
          if (!model) continue;
          const rig = this.enemyRigs.get(enemy.id);
          // Body meshes live under the rig pivot (issue #86 inserted it so
          // animations don't fight engine-driven position writes). If a
          // pivot is present, the silhouette's leaf count is its child
          // count; otherwise we fall back to the root's children (the
          // pre-#86 layout). The #85 contract — "multi-mesh Group, not a
          // single box" — still reads off this number.
          const pivot = model.children.find(
            (c) => c.name === "enemy-rig-pivot",
          );
          const childCount = pivot
            ? pivot.children.length
            : model.children.length;
          out.push({
            enemyId: enemy.id,
            kind: enemy.kind,
            childCount,
            // The four named clips every enemy carries (#86) — published
            // so the e2e harness can assert the contract without reaching
            // into the AnimationMixer internals from Playwright.
            clipNames: rig ? Object.keys(rig.clips) : [],
            activeClip: rig ? rig.active : "",
          });
        }
        return out;
      },
    };
  }

  /** Seed the simulation's enemy roster from SEED_ENEMIES, and build a
   *  low-poly model (issue #85) per kind so the scene renders distinct
   *  silhouettes the moment WebGL comes up. Each model is a `THREE.Group`
   *  of merged primitives — see models.ts. */
  private seedEnemies(): void {
    let nextId = 1;
    for (const seed of SEED_ENEMIES) {
      const id = nextId++;
      const size = ENEMY_MODEL_SIZE[seed.kind];
      const enemy: Enemy = {
        id,
        kind: seed.kind,
        x: seed.x,
        // Group origin sits at the enemy's CENTER (the builders place body
        // primitives symmetrically about y=0), so the center is half the
        // body height above the floor.
        y: size / 2,
        z: seed.z,
        hp: HP_BY_KIND[seed.kind],
        state: "idle",
        attackCooldown: 0,
        hitFlashTicks: 0,
      };
      this.state.enemies.push(enemy);

      const model = buildEnemyModel(seed.kind);
      model.position.set(enemy.x, enemy.y, enemy.z);
      // Stash the enemy id on the group AND on every child mesh so the
      // hitscan ray maps an Intersection (which only carries the leaf
      // Object3D under the group) back to the simulation entity. Previously
      // a single Mesh carried this in userData; now the leaf is one of many
      // body parts, so we tag each so any of them resolves the same id.
      model.userData.enemyId = id;
      model.traverse((child) => {
        child.userData.enemyId = id;
      });
      this.scene.add(model);
      this.enemyMeshes.set(id, model);
      // Build the per-enemy animation rig (#86): AnimationMixer + named
      // procedural clips (idle/walk/attack/death). The active clip follows
      // enemy.state — initial state is 'idle' so the boot pose is the idle
      // bob.
      const rig = buildEnemyAnimations(model);
      this.enemyRigs.set(id, rig);
    }
  }

  /** Seed the simulation's pickup roster from SEED_PICKUPS. No mesh in the
   *  scaffold — the e2e harness asserts on state (`pickups[i].taken`), and a
   *  visible mesh is a backlog polish slice. */
  private seedPickups(): void {
    let nextId = 1;
    for (const seed of SEED_PICKUPS) {
      this.state.pickups.push({
        id: nextId++,
        kind: seed.kind,
        x: seed.x,
        z: seed.z,
        taken: false,
      });
    }
  }

  /** Seed the doors roster from the current level map. Each `D` cell becomes
   *  one DoorState (initially closed) and one parallel doorCells entry the
   *  per-tick proximity check uses to push opens back into level.ts's
   *  collision cache. No mesh in the scaffold — the e2e harness asserts on
   *  state (`doors[i].open`); a sliding door mesh is a polish slice. */
  private seedDoors(): void {
    let nextId = 1;
    this.state.doors = [];
    this.doorCells = [];
    for (const d of levelDoors()) {
      this.state.doors.push({ id: nextId++, x: d.x, z: d.z, open: false });
      this.doorCells.push({ col: d.col, row: d.row });
    }
    // Reset the level's open-cell cache so the new stage's doors start closed.
    setOpenDoors([]);
  }

  /** Per-tick door update (#82): a door flips OPEN when the player's center
   *  is within DOOR_OPEN_RADIUS of its center; otherwise it's closed. After
   *  recomputing, push the set of currently-open cells back to level.ts so
   *  collision treats opened doors as walkable on the SAME tick.
   *
   *  Idempotent — running it twice with the same player position yields the
   *  same flags. */
  private updateDoors(): void {
    if (this.state.doors.length === 0) return;
    const p = this.state.player;
    const r2 = DOOR_OPEN_RADIUS * DOOR_OPEN_RADIUS;
    const openCells: Array<{ col: number; row: number }> = [];
    for (let i = 0; i < this.state.doors.length; i++) {
      const d = this.state.doors[i];
      const dx = p.x - d.x;
      const dz = p.z - d.z;
      d.open = dx * dx + dz * dz <= r2;
      if (d.open) openCells.push(this.doorCells[i]);
    }
    setOpenDoors(openCells);
  }

  /** Per-tick exit check (#82): if the player's current cell is an exit
   *  (`X` in the map), advance the stage and load the next map. Resets
   *  enemies/pickups/doors + repositions the player at the new map's spawn.
   *  When already on the final stage, flips status to 'won' instead so the
   *  player isn't stuck looping the last stage forever. */
  private checkExit(): void {
    const p = this.state.player;
    const cell = worldToCell(p.x, p.z);
    if (!cell) return;
    // Match against this stage's exit cells.
    const onExit = levelExits().some(
      (e) => e.col === cell.col && e.row === cell.row,
    );
    if (!onExit) return;
    if (this.state.stage >= TOTAL_STAGES) {
      // Last stage cleared — flip to a terminal "won" state. Future content
      // can add more stages; until then this is the end of the line.
      this.state.status = "won";
      return;
    }
    this.advanceToStage(this.state.stage + 1);
  }

  /** Shared stage-reload MECHANICS (#124): dispose every enemy mesh + rig,
   *  swap the level map to `stage`, reposition the player to the new
   *  spawn, update state.stage / state.field, and reseed the per-stage
   *  rosters (enemies, pickups, doors). DOES NOT touch state-reset policy
   *  — that's the caller's job. `restart()` wipes the full DoomState before
   *  calling this; `advanceToStage()` clears projectiles + zeros rosters
   *  before calling this (carrying score/weapon/health forward, per genre).
   *  Owning the mechanics in ONE place keeps the two paths from drifting. */
  private reloadStage(stage: number): void {
    // Drop existing enemy models from the scene; reseeding rebuilds them.
    // Each model is a Group of meshes (issue #85) — disposeEnemyModel
    // walks the children and frees every geometry + material.
    for (const model of this.enemyMeshes.values()) {
      this.scene.remove(model);
      disposeEnemyModel(model);
    }
    // Tear down every per-enemy mixer (#86) — the rig holds a reference to
    // the group it animates, so dropping the map releases both sides.
    for (const rig of this.enemyRigs.values()) {
      rig.mixer.stopAllAction();
      rig.mixer.uncacheRoot(rig.mixer.getRoot());
    }
    this.enemyRigs.clear();
    this.enemyMeshes.clear();

    // Swap the level map + place the player at the new stage's spawn.
    loadStage(stage);
    this.state.stage = stage;
    const spawn = findSpawn();
    this.state.player.x = spawn.x;
    this.state.player.z = spawn.z;
    this.state.field = { width: MAP_WIDTH, height: MAP_HEIGHT };

    // Reseed rosters from the (new) map's defaults. Enemies + pickups come
    // back to their seeded positions; doors from the new map's `D` cells.
    this.seedEnemies();
    this.seedPickups();
    this.seedDoors();
  }

  /** Load `stage` (1-indexed): swap the level map, reset the player to the
   *  new spawn, and clear all per-stage rosters. Does NOT reset score,
   *  weapon, or health — those carry across stages, matching the genre. */
  private advanceToStage(stage: number): void {
    // Clear in-flight projectiles + zero the per-stage rosters; the shared
    // reloadStage() helper handles the mesh/rig teardown + reseed.
    this.state.projectiles = [];
    this.state.enemies = [];
    this.state.pickups = [];
    this.reloadStage(stage);
  }

  /** Check whether the player is standing on any un-taken pickup; apply the
   *  first one within PICKUP_RADIUS. Called each fixed-step after the player
   *  moves so a walk-over grant lands the same tick the player crosses the
   *  pickup. */
  private checkPickups(): void {
    const p = this.state.player;
    for (let i = 0; i < this.state.pickups.length; i++) {
      const pk = this.state.pickups[i];
      if (pk.taken) continue;
      const dx = p.x - pk.x;
      const dz = p.z - pk.z;
      if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS) {
        this.applyPickup(i);
      }
    }
  }

  /** Test-only escape hatches. The e2e harness can force deterministic combat
   *  outcomes without aligning aim through the (not-yet-built) simulation. See
   *  `DoomInternals` in types.ts. Only the harness reads this; gameplay code
   *  never does. */
  private exposeInternals(): void {
    window.__doomInternals = {
      forceHit: (opts) => {
        if (this.state.enemies.length === 0) return;
        // Pick the first live enemy, or the one matching enemyId.
        const idx =
          opts?.enemyId === undefined
            ? this.state.enemies.findIndex((e) => e.state !== "dead")
            : this.state.enemies.findIndex((e) => e.id === opts.enemyId);
        if (idx < 0) return;
        // Synthesize a hit point + direction so #166's juice fires through
        // the same path as fireShot(). The enemy's published position is
        // the spark origin; the direction points from the player to the
        // enemy (so the spark normal pushes back toward the shooter and
        // the flinch knock — if non-lethal — moves the enemy further from
        // the player). Normalized to a unit vector; falls back to -z if
        // player and enemy share a cell.
        const enemy = this.state.enemies[idx];
        const willKill = enemy.hp - PLAYER_SHOT_DAMAGE <= 0;
        const dx = enemy.x - this.state.player.x;
        const dz = enemy.z - this.state.player.z;
        const dist = Math.hypot(dx, dz);
        const shotDir =
          dist > 0
            ? new THREE.Vector3(dx / dist, 0, dz / dist)
            : new THREE.Vector3(0, 0, -1);
        const hitPoint = new THREE.Vector3(enemy.x, enemy.y, enemy.z);
        const hitNormal = shotDir.clone().multiplyScalar(-1);
        this.damageEnemy(idx, PLAYER_SHOT_DAMAGE);
        this.applyHitJuice(idx, hitPoint, hitNormal, shotDir, willKill);
        this.publish();
      },
      forceDamage: (opts) => {
        const amount = opts?.amount ?? 10;
        this.damagePlayer(amount);
        this.publish();
      },
      forcePickup: (opts) => {
        const idx =
          opts?.id === undefined
            ? this.state.pickups.findIndex((p) => !p.taken)
            : this.state.pickups.findIndex((p) => p.id === opts.id);
        if (idx < 0) return;
        this.applyPickup(idx);
        this.publish();
      },
      advance: (opts) => {
        const steps = Math.max(0, Math.floor(opts.steps));
        if (steps === 0) return;
        // update()'s movement block only runs while 'playing'; the real game
        // flips here on first input, so do the same for the harness (only when
        // we're not in a terminal/won state — never resurrect a dead player).
        if (this.state.status === "ready") this.state.status = "playing";
        if (this.state.status !== "playing") return;
        // Install the forced movement override, then drive the fixed-step sim
        // synchronously — no rAF, no wall clock. Each update() advances the
        // player exactly PLAYER_SPEED_PER_TICK along the forced intent and runs
        // the same per-axis wall clamp as live play.
        this.forcedInput = {
          forward: Boolean(opts.forward),
          backward: Boolean(opts.back),
          left: Boolean(opts.left),
          right: Boolean(opts.right),
          // advance drives translation only; turning stays neutral.
          turnLeft: false,
          turnRight: false,
        };
        try {
          for (let i = 0; i < steps; i++) this.update();
        } finally {
          // Always restore live input, even if update() throws.
          this.forcedInput = null;
          // Neutralize the engine's main rAF loop accumulator so the next
          // wall-clock frame does NOT backfill catch-up update()s on top
          // of the deterministic step pump we just ran. Without this, the
          // HUD-opacity e2e (#205) races: between two `advance()` calls
          // the test awaits one rAF, the main loop catches up ~1 step,
          // hitFlashTicks decays an extra tick, the opacity ratio drifts
          // and the curve assertion fails under headless SwiftShader.
          // `lastTime = 0` re-triggers the loop's first-frame sentinel
          // (it'll seed itself to `now` on the next rAF and add 0 to the
          // accumulator), and `accumulator = 0` discards any stored time
          // that built up while status was 'ready' or during the eval
          // gap between forceDamage and the first advance().
          this.lastTime = 0;
          this.accumulator = 0;
        }
        this.publish();
      },
      fire: () => {
        // Synchronous test hook — bypasses the input edge-trigger and rAF so
        // the harness can assert on ammo/hits without racing the loop. Goes
        // through the SAME fireShot() path Space does.
        this.fireShot();
        this.publish();
      },
      frameProbe: () => {
        // Snapshot copy of the ring buffer, ordered oldest→newest. Until
        // FRAME_PROBE_CAPACITY frames have been captured the ring is
        // partially filled — we expose only the populated prefix so the
        // test never sees a zeroed slot from preallocation. Allocates on
        // the test path only; the per-frame WRITE in start()'s loop stays
        // in-place (#237 alloc-free crit). 
        const write = this.frameProbeWrite;
        const count = Math.min(write, FRAME_PROBE_CAPACITY);
        const samples: FrameProbeSample[] = new Array(count);
        // When the ring has wrapped, the oldest entry is at index
        // (write % CAPACITY); pre-wrap it's at index 0. Walking forward
        // `count` steps modulo CAPACITY gives oldest→newest order in both
        // regimes.
        const start =
          write < FRAME_PROBE_CAPACITY ? 0 : write % FRAME_PROBE_CAPACITY;
        for (let i = 0; i < count; i++) {
          const src = this.frameProbeBuffer[(start + i) % FRAME_PROBE_CAPACITY];
          samples[i] = {
            renderMs: src.renderMs,
            enemies: src.enemies,
            sparks: src.sparks,
            blood: src.blood,
            tick: src.tick,
          };
        }
        return { samples };
      },
      restart: () => {
        this.restart();
        this.publish();
      },
      corpseAlpha: (opts) => {
        const dead =
          opts?.enemyId === undefined
            ? this.state.enemies.find((e) => e.state === "dead")
            : this.state.enemies.find(
                (e) => e.id === opts.enemyId && e.state === "dead",
              );
        if (!dead) return null;
        // Same source of truth the render path reads — see corpseFadeAlpha.
        return corpseFadeAlpha(dead.deathTicks ?? 0);
      },
    };
  }

  /** Hard-reset the game (#91). Returns the engine to its boot configuration:
   *  status='ready', score=0, full health/armor/ammo, stage 1's seeded
   *  enemies/pickups/doors, no projectiles, no hits, no flash/shake pulses.
   *  Shared by the title-screen "press any key to start" path AND the
   *  game-over "press R to restart" path so both go through one code path.
   *
   *  Reuses `initialState()` for the contract surface, then layers the
   *  same seeded rosters the constructor builds — including rebuilding
   *  three.js models so the scene resets too. */
  private restart(): void {
    // Full state wipe — score/health/ammo/projectiles/hits/flash-shake all
    // back to boot. The shared reloadStage() helper then does the mechanics
    // (mesh + rig teardown, loadStage(1), reposition, reseed).
    this.state = initialState();
    this.reloadStage(1);
    // viewmodel is constructed once at boot and persists across restarts;
    // mirror its presence onto the freshly-wiped weapon state.
    this.state.weapon.viewmodelPresent = this.viewmodel !== null;

    // Clear terminal-lifecycle bookkeeping so the next death starts fresh.
    this.lostTick = null;
    this.gameOverFrames = 0;
  }

  /** Fire one hitscan shot from the current camera pose: cast a ray from the
   *  eye along the look direction (derived from yaw/pitch — independent of
   *  three.js matrix state, so this is correct whether or not render() has
   *  run this frame), find the nearest LIVE enemy mesh under the crosshair,
   *  and on a hit damage it + append a Hit record to the state contract.
   *
   *  AMMO POLICY: no fire at 0 ammo (the trigger click is silent). Otherwise
   *  every trigger pull decrements ammo by 1, hit or miss — that's the
   *  classic FPS pistol contract and what the e2e harness asserts on. The
   *  hit-record side is load-bearing for issue #76: a shot aligned at an
   *  enemy must register a hit the harness can read off `__doom.hits`. */
  private fireShot(): void {
    if (this.state.weapon.ammo <= 0) return;
    this.state.weapon.ammo -= 1;
    // Weapon-shot SFX (#89). Triggered on every fire that consumes ammo —
    // same edge as the muzzle flash. Silent no-op until audio is unlocked.
    this.audio.playWeapon();
    // Pulse the muzzle flash + recoil kick (#87). Every fire that consumes
    // ammo flashes, hit or miss — the same edge the e2e harness asserts on.
    // Mirror the tick counter onto state.weapon so the contract reflects
    // the pulse in the SAME synchronous publish fire() does.
    if (this.viewmodel) {
      pulseMuzzleFlash(this.viewmodel);
      this.state.weapon.muzzleFlashTicks = this.viewmodel.flashTicks;
    }

    const p = this.state.player;
    // Forward unit vector from (yaw, pitch) using the camera's YXZ Euler
    // order. At yaw=0,pitch=0 the player looks down -z (the contract's
    // stated facing); yaw increases turning left.
    const cp = Math.cos(p.pitch);
    const dir = new THREE.Vector3(
      -Math.sin(p.yaw) * cp,
      Math.sin(p.pitch),
      -Math.cos(p.yaw) * cp,
    );
    const origin = new THREE.Vector3(p.x, p.y, p.z);

    // Only intersect against the live enemy roster. Walls don't block the
    // hitscan in the scaffold — the level is small and the slice's goal is
    // "shot at an enemy registers a hit"; wall-occlusion is a follow-up.
    const models = Array.from(this.enemyMeshes.values());
    if (models.length === 0) return;
    this.raycaster.set(origin, dir);
    this.raycaster.near = 0;
    this.raycaster.far = CAMERA_FAR;
    // recursive=true: enemy models are now THREE.Group nodes (issue #85)
    // whose actual geometry lives on child meshes. Each child carries the
    // enemy id on userData (set in seedEnemies) so the Intersection still
    // maps back to the simulation entity.
    const intersections = this.raycaster.intersectObjects(models, true);
    if (intersections.length === 0) return;

    // Raycaster sorts by distance ascending — first is nearest.
    const hit = intersections[0];
    const enemyId = (hit.object.userData as { enemyId?: number }).enemyId;
    if (typeof enemyId !== "number") return;
    const idx = this.state.enemies.findIndex((e) => e.id === enemyId);
    if (idx < 0) return;

    // Hit-juice (#166): capture the hit point + face normal BEFORE damaging
    // (the enemy may flip to 'dead' inside damageEnemy and we still want the
    // sparks/flash to fire on the killing blow). The flinch-knock is gated
    // on the pre-damage hp so a lethal shot doesn't shove the corpse — the
    // death clip owns that beat.
    const hitPoint = hit.point.clone();
    const hitNormal =
      hit.face?.normal.clone() ?? dir.clone().multiplyScalar(-1);
    const willKill = this.state.enemies[idx].hp - PLAYER_SHOT_DAMAGE <= 0;

    this.damageEnemy(idx, PLAYER_SHOT_DAMAGE);
    this.state.hits.push({ enemyId, tick: this.state.tick });
    this.applyHitJuice(idx, hitPoint, hitNormal, dir, willKill);
  }

  /** Apply the visual/feel feedback that lands when a player shot connects
   *  (#166): per-enemy body flash + hitstop freeze + connect-shake + impact
   *  spark burst + non-lethal flinch knock. Shared between fireShot() (real
   *  aim) and the forceHit test hook (synthesized point/dir). Called AFTER
   *  damageEnemy so the lethal/non-lethal branch can read settled state;
   *  `willKill` is computed pre-damage by the caller so a lethal shot still
   *  flashes the corpse (it exists for one death-frame) but doesn't shove
   *  it (death clip owns that beat). */
  private applyHitJuice(
    enemyIdx: number,
    hitPoint: THREE.Vector3,
    hitNormal: THREE.Vector3,
    shotDir: THREE.Vector3,
    willKill: boolean,
  ): void {
    const enemy = this.state.enemies[enemyIdx];
    if (!enemy) return;

    // Body emissive flash on the hit enemy. Even on a lethal hit the enemy
    // still exists this tick (it's culled NEXT tick), so the flash reads
    // alongside the death clip's first frame.
    enemy.hitFlashTicks = ENEMY_HIT_FLASH_TICKS;

    // Global hitstop: clamp (never `+=`). A multi-pellet future must not
    // stack itself into a frozen sim — past learning from Galaga's juice.
    this.state.hitstopTicks = Math.max(
      this.state.hitstopTicks,
      HITSTOP_TICKS_ON_HIT,
    );

    // Connect-shake: parallel to player-damage shake so the two stay
    // semantically separate. Clamp the same way.
    this.state.hitShakeTicks = Math.max(
      this.state.hitShakeTicks,
      HIT_SHAKE_TICKS,
    );

    // Impact-spark burst. 6 sparks spawn at the hit point with velocities
    // chosen from a FIXED offset table (deterministic — no Math.random) so
    // every shot at the same point spawns the same burst. The face normal
    // pushes the spark cone back toward the shooter; per-spark jitter from
    // the table fans the cone out.
    this.spawnImpactSparks(hitPoint, hitNormal);

    // Flinch knock (non-lethal only). Push the enemy back along the SHOT
    // direction (not the surface normal — that would knock sideways on a
    // grazing hit). Cap against collidesAt so it can't tunnel through walls.
    if (!willKill && enemy.state !== "dead") {
      const knockX = enemy.x + shotDir.x * ENEMY_FLINCH_KNOCK;
      const knockZ = enemy.z + shotDir.z * ENEMY_FLINCH_KNOCK;
      if (!collidesAt(knockX, knockZ, 0)) {
        enemy.x = knockX;
        enemy.z = knockZ;
      }
    }
  }

  /** Spawn IMPACT_SPARK_COUNT sparks at `point`, fanned out along `normal`.
   *  Deterministic — velocities come from a fixed offset table (no
   *  Math.random) so the same hit point produces the same burst. Each spark
   *  lives IMPACT_SPARK_LIFETIME ticks; the per-tick step + renderer pool
   *  live in stepImpactSparks() / syncImpactSparkMeshes(). */
  private spawnImpactSparks(point: THREE.Vector3, normal: THREE.Vector3): void {
    // 6 fixed jitter directions on the unit sphere — a small icosahedral
    // fan so the burst reads as 3D, not a flat ring. The 0.08 scalar in
    // the spec sets the base speed along the normal; jitter adds spread.
    const JITTER: ReadonlyArray<readonly [number, number, number]> = [
      [0.6, 0.7, 0.0],
      [-0.6, 0.7, 0.0],
      [0.0, 0.7, 0.6],
      [0.0, 0.7, -0.6],
      [0.5, 0.3, 0.5],
      [-0.5, 0.3, -0.5],
    ];
    const base = normal.clone().multiplyScalar(0.08);
    const n = Math.min(IMPACT_SPARK_COUNT, JITTER.length);
    for (let i = 0; i < n; i++) {
      const j = JITTER[i];
      this.state.impactSparks.push({
        x: point.x,
        y: point.y,
        z: point.z,
        vx: base.x + j[0] * 0.04,
        vy: base.y + j[1] * 0.04,
        vz: base.z + j[2] * 0.04,
        ticksLeft: IMPACT_SPARK_LIFETIME,
      });
    }
  }

  /** Advance every live impact spark by one fixed-step: integrate position,
   *  apply a tiny gravity (vy -= 0.005), and decrement ticksLeft. Sparks
   *  with ticksLeft<=0 are pruned in-place. Allocation-light: rebuilds the
   *  array only if at least one spark expired this tick. */
  private stepImpactSparks(): void {
    if (this.state.impactSparks.length === 0) return;
    const survivors: DoomState["impactSparks"] = [];
    let pruned = false;
    for (const s of this.state.impactSparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.z += s.vz;
      s.vy -= 0.005;
      s.ticksLeft -= 1;
      if (s.ticksLeft <= 0) {
        pruned = true;
        continue;
      }
      survivors.push(s);
    }
    if (pruned) this.state.impactSparks = survivors;
  }

  /** Deal `damage` to the enemy at `idx`. On lethal damage the enemy flips to
   *  'dead', its score is awarded, and its mesh is removed from the scene.
   *  Centralized so the forceHit hook and the (future) projectile-collision
   *  pass take the same path. */
  private damageEnemy(idx: number, damage: number): void {
    const e = this.state.enemies[idx];
    if (!e || e.state === "dead") return;
    e.hp -= damage;
    // Enemy-hit SFX (#89). Every landed strike pings, fatal or not — the
    // death sound below is layered on top for the killing blow.
    this.audio.playEnemyHit();
    if (e.hp <= 0) {
      e.hp = 0;
      e.state = "dead";
      this.state.score += SCORE_BY_KIND[e.kind];
      // Death SFX (#89) — longer pitched-down groan distinct from the hit
      // ping, so the killing blow reads aurally without needing the visual.
      this.audio.playEnemyDeath();
      // Switch the rig (#86) to its death clip BEFORE the model is dropped
      // — the harness asserts on `__doomModels.list()` finding
      // `activeClip === 'death'` after forceHit. Removing the rig is
      // deferred to the per-update cull (next block in update()), so the
      // contract is observable in the SAME synchronous publish forceHit
      // does.
      const rig = this.enemyRigs.get(e.id);
      if (rig) setActiveClip(rig, "death");
      // Model removal also defers to the per-update cull so the death-clip
      // pose is observable for the full corpse beat (#194), then alpha-
      // fades over the last CORPSE_FADE frames before drop.

      // --- KILL JUICE (#194) -------------------------------------------
      // Doom = HEAVY. Stack a bigger beat ON TOP of the universal connect
      // juice that already fired in applyHitJuice: heavier hitstop, a
      // distinct kill-shake channel, blood spray, and a corpse hold
      // counter. All clamped via Math.max — never `+=` — past Galaga
      // learning that cumulative juice freezes the sim.
      this.state.hitstopTicks = Math.max(
        this.state.hitstopTicks,
        KILL_HITSTOP_TICKS,
      );
      this.state.killShakeTicks = Math.max(
        this.state.killShakeTicks,
        KILL_SHAKE_TICKS,
      );
      // Blood spawns at the body center (the published enemy position).
      this.spawnBloodSpray(new THREE.Vector3(e.x, e.y, e.z));
      // Arm the corpse-beat counter; the cull block in update() increments
      // this each tick and only frees the enemy when it crosses
      // CORPSE_HOLD_TICKS.
      e.deathTicks = 0;
    }
  }

  /** Spawn BLOOD_DROP_COUNT drops at `point` (#194). Distinct from
   *  spawnImpactSparks: different speed/gravity/size constants, no
   *  surface-normal cone — the burst is hemispherical, biased UP+OUT, so
   *  drops arc and fall under their own (heavier) gravity. Deterministic
   *  jitter table — no Math.random. Each drop carries a small per-index
   *  bias so the 14 don't read as a perfect ring. */
  private spawnBloodSpray(point: THREE.Vector3): void {
    // 14 fixed unit-ish directions on the upper hemisphere (no straight-
    // down; gravity will pull them earthward anyway). XYZ tuples — vy is
    // always > 0 so the spray throws UP first, then falls.
    const JITTER: ReadonlyArray<readonly [number, number, number]> = [
      [0.8, 0.6, 0.0],
      [-0.8, 0.6, 0.0],
      [0.0, 0.6, 0.8],
      [0.0, 0.6, -0.8],
      [0.6, 0.8, 0.6],
      [-0.6, 0.8, -0.6],
      [0.6, 0.8, -0.6],
      [-0.6, 0.8, 0.6],
      [0.9, 0.3, 0.3],
      [-0.9, 0.3, -0.3],
      [0.3, 0.3, 0.9],
      [-0.3, 0.3, -0.9],
      [0.4, 1.0, 0.0],
      [-0.4, 1.0, 0.0],
    ];
    const n = Math.min(BLOOD_DROP_COUNT, JITTER.length);
    for (let i = 0; i < n; i++) {
      const j = JITTER[i];
      // Per-drop bias so a tight burst doesn't look like a ring; the
      // ratios are arbitrary but DETERMINISTIC (i-derived, not random).
      const bias = (i % 3) * 0.01 - 0.01;
      this.state.bloodDrops.push({
        x: point.x,
        y: point.y,
        z: point.z,
        vx: j[0] * BLOOD_DROP_SPEED + bias,
        vy: j[1] * BLOOD_DROP_SPEED,
        vz: j[2] * BLOOD_DROP_SPEED - bias,
        ticksLeft: BLOOD_DROP_LIFETIME,
      });
    }
  }

  /** Advance every live blood drop by one fixed-step (#194): integrate
   *  position, apply the heavier blood gravity (vy -= BLOOD_DROP_GRAVITY),
   *  and decrement ticksLeft. Drops with ticksLeft<=0 are pruned in-place
   *  — same allocation-light pattern as stepImpactSparks. */
  private stepBloodDrops(): void {
    if (this.state.bloodDrops.length === 0) return;
    const survivors: DoomState["bloodDrops"] = [];
    let pruned = false;
    for (const d of this.state.bloodDrops) {
      d.x += d.vx;
      d.y += d.vy;
      d.z += d.vz;
      d.vy -= BLOOD_DROP_GRAVITY;
      d.ticksLeft -= 1;
      if (d.ticksLeft <= 0) {
        pruned = true;
        continue;
      }
      survivors.push(d);
    }
    if (pruned) this.state.bloodDrops = survivors;
  }

  /** Sync the blood-drop mesh pool to `state.bloodDrops` (#194). Mirrors
   *  syncImpactSparkMeshes — one visible mesh per live drop, extras
   *  hidden. Scale shrinks toward 0 over the drop's lifetime so the spray
   *  dissipates rather than snaps off when each drop expires. */
  private syncBloodDropMeshes(): void {
    const drops = this.state.bloodDrops;
    if (drops.length > 0 && this.bloodGeometry === null) {
      this.bloodGeometry = new THREE.SphereGeometry(BLOOD_DROP_SIZE, 6, 6);
      this.bloodMaterial = new THREE.MeshBasicMaterial({
        color: BLOOD_DROP_COLOR,
        // Blood reads dark and grounded — keep it inside the fog so distant
        // sprays don't read as bright dots, unlike sparks which intentionally
        // pop full-bright.
        fog: true,
      });
    }
    while (
      this.bloodMeshes.length < drops.length &&
      this.bloodGeometry &&
      this.bloodMaterial
    ) {
      const m = new THREE.Mesh(this.bloodGeometry, this.bloodMaterial);
      m.visible = false;
      this.scene.add(m);
      this.bloodMeshes.push(m);
    }
    for (let i = 0; i < this.bloodMeshes.length; i++) {
      const m = this.bloodMeshes[i];
      const d = drops[i];
      if (!d) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(d.x, d.y, d.z);
      const k = Math.max(0, d.ticksLeft / BLOOD_DROP_LIFETIME);
      m.scale.setScalar(k);
    }
  }

  /** Reduce player health by `amount`, routing through armor first (armor
   *  soaks a fraction; the backlog tunes the ratio). On lethal damage the
   *  player dies and the two-step terminal lifecycle arms (mirrors Galaga's
   *  killPlayer → 'lost' → 'gameover'). */
  private damagePlayer(amount: number): void {
    const p = this.state.player;
    if (!p.alive) return; // already dead, no double-tap
    // Armor absorbs up to a third of the hit before health takes the rest.
    const soaked = Math.min(p.armor, Math.floor(amount / 3));
    p.armor -= soaked;
    p.health -= amount - soaked;
    // Damage hitstop (#205) — 3-frame freeze BEFORE the flash/shake writes.
    // Half KILL_HITSTOP_TICKS (6): the kill is the player's victory thunk,
    // a hit is the world's; the kill stays heavier. Math.max clamp so a
    // future multi-hit (overlapping enemy + projectile on the same tick)
    // can't accumulate into a frozen sim — same pattern as #166 + #194.
    this.state.hitstopTicks = Math.max(
      this.state.hitstopTicks,
      DAMAGE_HITSTOP_TICKS,
    );
    // Pulse the damage feedback (#91): red flash overlay + camera shake.
    // Both counters are decremented each fixed-step; the HUD overlay reads
    // hitFlashTicks > 0 and the render pass perturbs the camera while
    // shakeTicks > 0. Pulsing here (rather than at the call sites) means
    // ALL damage paths — enemy melee, enemy projectile, forceDamage — pulse
    // identically.
    this.state.hitFlashTicks = HIT_FLASH_TICKS;
    this.state.shakeTicks = SHAKE_TICKS;
    // Lingering wobble (#205): slow horizontal sway that sells the daze
    // after the initial THUNK. Decayed in update()'s !frozen block; summed
    // into ox in syncCamera() at 0.3× SHAKE_AMPLITUDE. Math.max-clamped
    // (NEVER `+=`) so back-to-back hits arm a single fresh window, not a
    // stacking infinite wobble.
    this.state.damageWobbleTicks = Math.max(
      this.state.damageWobbleTicks,
      DAMAGE_WOBBLE_TICKS,
    );
    if (p.health <= 0) {
      p.health = 0;
      p.alive = false;
      // Arm the gameover transition (see update()). 'lost' is the immediate
      // "you died" flip; 'gameover' is the settled terminal state.
      this.state.status = "lost";
      this.lostTick = this.state.tick;
    }
  }

  /** Apply the pickup at `idx`: mark it taken and grant its effect. */
  private applyPickup(idx: number): void {
    const pk = this.state.pickups[idx];
    if (!pk || pk.taken) return;
    pk.taken = true;
    // Pickup SFX (#89). Triggered the moment the pickup flips taken, so
    // walk-overs AND forcePickup() both ping (the harness asserts via the
    // latter). Silent no-op until audio is unlocked.
    this.audio.playPickup();
    const p = this.state.player;
    switch (pk.kind) {
      case "health":
        p.health = Math.min(100, p.health + 25);
        break;
      case "armor":
        p.armor = Math.min(100, p.armor + 25);
        break;
      case "ammo":
        this.state.weapon.ammo += 20;
        break;
    }
    // PICKUP JUICE (#230). Arm the affirmative flash. CLOBBER both fields
    // (NOT Math.max on the counter): if a player walks over health while
    // an armor flash is still alive, the kind cue MUST switch to the new
    // kind — otherwise the blue vignette would lie about the green grant.
    // Counter is single-channel by `pickupKindFlash`'s design, so
    // clobbering can't compound into a frozen window the way an additive
    // hitstop could (past Galaga learning re Math.max on anonymous
    // channels). No hitstop arm — a gift shouldn't interrupt the world's
    // beat; this is the HEAVY-AFFIRMATIVE counterpart to #194's HEAVY
    // punishment.
    this.state.pickupFlashTicks = PICKUP_FLASH_TICKS;
    this.state.pickupKindFlash = pk.kind;
    // PICKUP MESSAGE (#281). The world that takes from the player (damage
    // wobble #205, blood spray #194, kill-shake #194) now SPEAKS when it
    // gives — same posture, opposite charge. CLOBBER both fields (NOT
    // Math.max — the message is a single-channel identity cue, same shape
    // as pickupKindFlash): a fresh grant mid-flash MUST replace the line
    // so a health-then-armor sequence reads the armor line, not the stale
    // health one. Counter lives in lockstep with pickupFlashTicks so the
    // tint + line enter and exit together — one beat, one voice.
    this.state.pickupMessage = PICKUP_MESSAGES[pk.kind];
    this.state.pickupMessageTicks = PICKUP_FLASH_TICKS;
  }

  /** First input leaves the READY state; once playing, the loop ticks.
   *  Keyboard goes through the InputSource (so its onFirstInput hook fires the
   *  flip); pointerdown on the canvas is a separate path for click/tap on the
   *  READY screen AND is where we ask the browser for pointer-lock (must be a
   *  user-gesture handler). */
  private bindInput(): void {
    const start = (): void => {
      // Game-over → ready→playing on any input: first reset state via the
      // restart() path so a stale roster doesn't carry into the new run, then
      // fall through to the normal ready→playing flip. Title-screen path is
      // the second branch — first input flips ready→playing directly. We
      // gate on the SETTLED terminal states ('gameover' / 'won'), NOT the
      // transitional 'lost' beat — the death animation reads for ~0.5s
      // before settling on 'gameover', and clicking during that beat
      // shouldn't yank the player back to playing mid-death.
      if (this.state.status === "gameover" || this.state.status === "won") {
        this.restart();
      }
      if (this.state.status === "ready") this.state.status = "playing";
      // First user gesture — unlock WebAudio (#89). Autoplay policy gates
      // AudioContext creation behind a gesture; idempotent past first call.
      this.audio.unlock();
    };
    this.input.onFirstInput(start);
    // Dedicated R-to-restart from any state, so a player can hard-reset
    // mid-run without dying first. Goes through the same restart() path
    // the game-over screen uses, so the wire is shared.
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "r" || ev.key === "R") {
        this.restart();
        this.publish();
      }
    });
    this.canvas.addEventListener("pointerdown", () => {
      start();
      // Request pointer-lock for mouselook. Wrapped in try/catch + feature
      // check because jsdom / older browsers / headless Chromium may not
      // expose it, and the game must still be playable via arrow-key turning.
      const req = (this.canvas as HTMLCanvasElement & {
        requestPointerLock?: () => void;
      }).requestPointerLock;
      if (typeof req === "function") {
        try {
          req.call(this.canvas);
        } catch {
          // Pointer-lock unavailable; keyboard turning still works.
        }
      }
    });
  }

  start(): void {
    const loop = (now: number): void => {
      if (this.lastTime === 0) this.lastTime = now;
      this.accumulator += now - this.lastTime;
      this.lastTime = now;
      // Clamp to avoid a spiral-of-death after a long tab-away.
      if (this.accumulator > 250) this.accumulator = 250;
      while (this.accumulator >= STEP_MS) {
        this.update();
        this.accumulator -= STEP_MS;
      }
      // Frame-time probe (#237). Time JUST render() — update() cost lives on
      // the decoupled sim path and shouldn't bias the per-frame budget the
      // player feels. The merge-gate spec reads `__doomInternals.frameProbe()`
      // and asserts p99 ≤ 16.7 ms across a steady-state window.
      const t0 = performance.now();
      this.render();
      const renderMs = performance.now() - t0;
      // Write in place at ring-index; mutating preallocated entry fields so
      // the render path stays allocation-free per frame (acceptance crit).
      const slot =
        this.frameProbeBuffer[this.frameProbeWrite % FRAME_PROBE_CAPACITY];
      slot.renderMs = renderMs;
      slot.enemies = this.state.enemies.length;
      slot.sparks = this.state.impactSparks.length;
      slot.blood = this.state.bloodDrops.length;
      slot.tick = this.state.tick;
      this.frameProbeWrite += 1;
      this.publish();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** One fixed-step logical update. The tick counter only advances while
   *  'playing' so the harness can distinguish a started loop from the idle
   *  READY screen. DETERMINISM CONTRACT: no Math.random and no wall-clock
   *  reads in this path — every step is a pure function of prior state +
   *  sampled input. Movement/AI/combat land here as backlog slices. */
  private update(): void {
    // 'lost' → 'gameover' transition. We use lostTick (captured at the moment
    // health hit 0, while state.tick was still advancing) and count
    // wall-clock-independent fixed-steps via gameOverFrames so the hand-off
    // lands even though state.tick is frozen once status leaves 'playing'.
    if (this.state.status === "lost" && this.lostTick !== null) {
      this.gameOverFrames += 1;
      if (this.gameOverFrames >= GAMEOVER_HOLD_FRAMES) {
        this.state.status = "gameover";
        this.lostTick = null;
      }
    }

    if (this.state.status === "playing") {
      this.state.tick += 1;

      // HITSTOP GATE (#166). When the player's shot connects, the engine
      // freezes for HITSTOP_TICKS_ON_HIT frames so the impact reads. Input
      // still drains (we sample below regardless), the tick counter still
      // advances (above), and the renderer still draws — so the spark +
      // body flash are visible DURING the freeze. What's frozen: move/look,
      // pickups, doors, exit, enemy AI, projectiles, viewmodel ticks, and
      // the per-tick decay of all feedback pulses. Without freezing the
      // decays, the very ticks the player can see the flash are the ones
      // it's aging through — past Galaga learning, the flash collapses
      // visually because frozen frames age the counter.
      let frozen = false;
      if (this.state.hitstopTicks > 0) {
        // Freeze flag captured BEFORE the decrement so the full
        // HITSTOP_TICKS_ON_HIT frames count as frozen. Without this the
        // last freeze frame thaws early (decrement → 0 → !frozen) and
        // the impact only reads for N-1 frames.
        frozen = true;
        this.state.hitstopTicks -= 1;
      }

      // Decay feedback pulses ONLY when not frozen. #91's player-damage
      // flash + shake, #166's connect-shake, and every per-enemy
      // hitFlashTicks all age here so the visuals fade smoothly post-freeze.
      if (!frozen) {
        if (this.state.hitFlashTicks > 0) this.state.hitFlashTicks -= 1;
        if (this.state.shakeTicks > 0) this.state.shakeTicks -= 1;
        if (this.state.hitShakeTicks > 0) this.state.hitShakeTicks -= 1;
        if (this.state.killShakeTicks > 0) this.state.killShakeTicks -= 1;
        // #205: lingering damage wobble. Same gate as the other channels —
        // freezes with the world during hitstop so the dazed sway doesn't
        // age out during the freeze.
        if (this.state.damageWobbleTicks > 0)
          this.state.damageWobbleTicks -= 1;
        // #230 — pickup flash. Decays alongside the other channels; the
        // kind cue clears in lockstep with the counter hitting 0 so a
        // resting (post-decay) snapshot reads `pickupFlashTicks === 0 &&
        // pickupKindFlash === null` (the HUD vignette gate).
        if (this.state.pickupFlashTicks > 0) {
          this.state.pickupFlashTicks -= 1;
          if (this.state.pickupFlashTicks === 0)
            this.state.pickupKindFlash = null;
        }
        // #281 — pickup MESSAGE. Lockstep with pickupFlashTicks: decayed in
        // the same `!frozen` gate; cleared to null when the counter hits 0.
        // Kept as a separate counter (rather than reading pickupFlashTicks
        // directly) so the contract stays surface-additive — future taste
        // passes could untether the line from the tint window without
        // touching the existing #230 gate.
        if (this.state.pickupMessageTicks > 0) {
          this.state.pickupMessageTicks -= 1;
          if (this.state.pickupMessageTicks === 0)
            this.state.pickupMessage = null;
        }
        for (const e of this.state.enemies) {
          if (e.hitFlashTicks > 0) e.hitFlashTicks -= 1;
        }
      }

      // Impact sparks step every tick INCLUDING frozen ones — wait, no:
      // freezing the spark step is what gives them the suspended-in-air
      // hang the rest of the world has. Same gate. Renderer still draws
      // them, but they don't move during the freeze.
      if (!frozen) {
        this.stepImpactSparks();
        // Blood drops freeze with the world too — #194's heavy hitstop
        // hangs the spray mid-arc for max thunk before it falls.
        this.stepBloodDrops();
      }

      // The sim pass below is gated on `!frozen` (captured pre-decrement
      // above) so it skips for the FULL hitstop duration, not N-1 frames.
      // While frozen: no input sample (queued fires can't double-fire on
      // unfreeze), no move, no AI, no projectiles, no viewmodel tick. The
      // death-cull at the END of update() runs OUTSIDE this `playing` gate
      // and is unaffected — a kill landed on the freeze-trigger tick still
      // gets its mesh + rig disposed on schedule.
      if (!frozen) {
      // Sample input once per fixed-step so movement is deterministic at 60 Hz
      // regardless of render cadence. consumeFire() / consumeMouseDelta() are
      // drained per tick so input doesn't pile up across frames.
      //
      // TEST-ONLY: when the `advance` hook has set a forced-input override we
      // read movement from it instead of the live keyboard (and skip mouselook)
      // so the harness gets frame-rate-independent travel. forcedInput is null
      // in all real play — see the field decl + exposeInternals().
      const snap = this.forcedInput ?? this.input.read();
      // Edge-triggered fire (issue #76): one Space keydown = one shot. Skip
      // under forced input — the harness drives fire through the `fire`
      // internal, not the keyboard buffer, so a synthetic Space press during
      // an `advance` step pump can't double-fire.
      if (!this.forcedInput && this.input.consumeFire()) {
        this.fireShot();
      }
      const mouse = this.forcedInput
        ? { dx: 0, dy: 0 }
        : this.input.consumeMouseDelta();

      // --- LOOK -----------------------------------------------------------
      // Yaw: mouse-x adds to yaw (locked pointer convention is rightward
      // movementX → look right → DECREASE yaw with our Y-up / -z-forward
      // basis). Keyboard ArrowLeft/Right also turn.
      const p = this.state.player;
      // Mouse: rightward (dx>0) should turn the view right. In a Y-up,
      // looking-down-(-z)-at-yaw-0 frame, "turn right" is a NEGATIVE yaw
      // change (right-handed rotation about +y).
      p.yaw -= mouse.dx * MOUSE_SENSITIVITY;
      // Mouse: downward (dy>0) should pitch the view down. Pitch is rotation
      // about local x; positive pitch looks up, so dy>0 → decrease pitch.
      p.pitch -= mouse.dy * MOUSE_SENSITIVITY;
      // Arrow-key turning (mouselook fallback / keyboard-only play).
      if (snap.turnLeft) p.yaw += PLAYER_TURN_PER_TICK;
      if (snap.turnRight) p.yaw -= PLAYER_TURN_PER_TICK;
      // Clamp pitch so the camera never flips over.
      if (p.pitch > PITCH_LIMIT) p.pitch = PITCH_LIMIT;
      if (p.pitch < -PITCH_LIMIT) p.pitch = -PITCH_LIMIT;

      // --- MOVE -----------------------------------------------------------
      // Build a movement intent in player-local space (forward/back +
      // strafe). At yaw=0 the player looks down -z, so "forward" is the
      // negative-z unit vector rotated by yaw.
      let mz = 0;
      let mx = 0;
      if (snap.forward) mz -= 1;
      if (snap.backward) mz += 1;
      if (snap.left) mx -= 1;
      if (snap.right) mx += 1;
      // Track whether the player intends to move THIS tick — fed into the
      // weapon viewmodel's bob coupling so the gun's cadence syncs with
      // motion (Diego juice ceiling #21). Binary today (input is binary);
      // when an analog stick lands this becomes the normalized magnitude.
      // Persisted on the instance so the stepViewmodel call further down
      // (outside this block) can read it without restructuring the scope.
      this.moveSpeedFrac = mx !== 0 || mz !== 0 ? 1 : 0;
      if (mx !== 0 || mz !== 0) {
        // Normalize so diagonal movement isn't √2 faster than cardinal.
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;
        const cos = Math.cos(p.yaw);
        const sin = Math.sin(p.yaw);
        // Rotate (mx, mz) by yaw about +y. With yaw=0, the rotation is the
        // identity → forward intent (mz=-1) becomes world delta (0,-1).
        const dx = mx * cos + mz * sin;
        const dz = -mx * sin + mz * cos;
        // PER-AXIS COLLISION against the level map (issue #75): resolve x and
        // z independently so sliding along a wall works (hit a north wall →
        // forward intent zeros z but keeps x). collidesAt queries level.ts
        // cells — off-map is treated as solid, so the map's outer ring IS the
        // arena boundary (no separate field-box clamp).
        const nextX = p.x + dx * PLAYER_SPEED_PER_TICK;
        if (!collidesAt(nextX, p.z, PLAYER_RADIUS)) p.x = nextX;
        const nextZ = p.z + dz * PLAYER_SPEED_PER_TICK;
        if (!collidesAt(p.x, nextZ, PLAYER_RADIUS)) p.z = nextZ;
      }

      // --- PICKUPS (issue #80) --------------------------------------------
      // After movement settles, see if the player is now standing on any
      // un-taken pickup; the first one in range is granted this tick. Runs
      // unconditionally (even when no movement keys were held) so a pickup
      // dropped at the player's feet by some future mechanic still grants.
      this.checkPickups();

      // --- DOORS (issue #82) ----------------------------------------------
      // Flip door.open per the player's current proximity. Pushed BEFORE the
      // exit check so a door blocking the path to the exit opens this tick
      // and the next tick's movement isn't a frame behind.
      this.updateDoors();

      // --- LEVEL EXIT (issue #82) -----------------------------------------
      // If the player is standing on an `X` cell, advance to the next stage
      // (resets enemies/pickups/doors + repositions to the new spawn). On
      // the final stage, status flips to 'won' instead.
      this.checkExit();

      // --- ENEMY AI (issue #77) + DAMAGE (issue #79) + RANGED FIRE (#81) ---
      // One step per live enemy, before the death-cull below — so an enemy
      // that the player just killed via fireShot() this same tick doesn't
      // get a posthumous chase step. stepEnemyAI() handles its own state
      // gating; dead enemies are a no-op. For melee kinds the returned
      // `damage` (>0 when an attacking enemy's cooldown elapsed) goes
      // through damagePlayer() so armor absorption + the two-step terminal
      // lifecycle stay centralized. For ranged kinds (baron) the result
      // sets `fireProjectile`, telling us to spawn a `from:'enemy'`
      // projectile aimed at the player. We stop polling enemies once the
      // player is dead — no posthumous hits.
      for (const enemy of this.state.enemies) {
        const res = stepEnemyAI(enemy, this.state.player);
        if (res.damage > 0 && this.state.player.alive) {
          this.damagePlayer(res.damage);
        }
        if (res.fireProjectile && this.state.player.alive) {
          this.spawnEnemyProjectile(enemy);
        }
      }

      // --- PROJECTILES (issue #81) ----------------------------------------
      // Advance every in-flight projectile by its velocity, check contact
      // with the player (for enemy-origin) or with live enemies (for
      // player-origin), and apply damage on hit. Spent projectiles (hit, or
      // wandered into a solid wall / out of bounds) are removed in-place.
      this.stepProjectiles();

      // --- VIEWMODEL (issue #87) ------------------------------------------
      // Tick the viewmodel's recoil decay + flash countdown + idle-bob
      // phase. All easing lives here in the fixed-step path so it's
      // deterministic (no wall-clock reads). The flash tick mirror onto
      // state.weapon lets the e2e harness + HUD observe the pulse without
      // reaching into three.js.
      if (this.viewmodel) {
        // Speed-couple the weapon bob (Diego juice ceiling #21): at rest
        // the gun breathes slow + tiny; in motion it swaggers at footstep
        // cadence with a lateral figure-eight. `moveSpeedFrac` was set
        // above in the move block (0 when no input, 1 when any direction
        // key is held).
        stepViewmodel(this.viewmodel, this.moveSpeedFrac);
        this.state.weapon.muzzleFlashTicks = this.viewmodel.flashTicks;
      }
      } // close `if (!frozen)` — sim pass gate (#166)
    }

    // Corpse beat (#194) + cull. Dead enemies are held on the roster for
    // CORPSE_HOLD_TICKS fixed-steps so the death pose READS for the full
    // heavy-genre beat (Doom = HEAVY). Each non-frozen tick we increment
    // `deathTicks` on every dead enemy; only the ones whose counter has
    // crossed CORPSE_HOLD_TICKS get their mesh + rig disposed and pruned
    // from the roster. The renderer reads `deathTicks` to fade material
    // alpha over the last CORPSE_FADE_TICKS frames before drop.
    //
    // The cull runs OUTSIDE the `playing` gate so an enemy killed on the
    // same tick the player dies (status flips to 'lost' inside the block)
    // still progresses through the corpse beat — otherwise a rig leaks
    // for the page's lifetime, since `lost`/`gameover` never re-enter
    // the playing path. We DO gate the deathTicks increment on hitstop
    // freeze so the corpse beat hangs with the rest of the world during
    // the kill freeze (consistent with sparks/blood/decays).
    const cullFrozen = this.state.hitstopTicks > 0;
    const hasDead = this.state.enemies.some((e) => e.state === "dead");
    if (hasDead) {
      if (!cullFrozen) {
        for (const e of this.state.enemies) {
          if (e.state !== "dead") continue;
          // Arm on first sight (covers any death path that forgot to set
          // it — defensive, not load-bearing for the current branch).
          if (e.deathTicks === undefined) e.deathTicks = 0;
          else e.deathTicks += 1;
        }
      }
      for (const e of this.state.enemies) {
        if (e.state !== "dead") continue;
        if ((e.deathTicks ?? 0) < CORPSE_HOLD_TICKS) continue;
        const model = this.enemyMeshes.get(e.id);
        if (model) {
          this.scene.remove(model);
          disposeEnemyModel(model);
          this.enemyMeshes.delete(e.id);
        }
        const rig = this.enemyRigs.get(e.id);
        if (rig) {
          rig.mixer.stopAllAction();
          rig.mixer.uncacheRoot(rig.mixer.getRoot());
          this.enemyRigs.delete(e.id);
        }
      }
      this.state.enemies = this.state.enemies.filter(
        (e) => !(e.state === "dead" && (e.deathTicks ?? 0) >= CORPSE_HOLD_TICKS),
      );
    }
  }

  /** Spawn a fireball from `enemy` aimed at the player's current floor-plane
   *  position. Velocity is the unit vector toward the player scaled to one
   *  tick's travel; height tracks the enemy's body so a baron's fireball
   *  reads as coming from its torso, not the floor. Called by update() when
   *  stepEnemyAI() signals a ranged attack tick (#81). */
  private spawnEnemyProjectile(enemy: Enemy): void {
    const p = this.state.player;
    const dx = p.x - enemy.x;
    const dz = p.z - enemy.z;
    const dist = Math.hypot(dx, dz);
    if (dist === 0) return; // co-located; no direction
    const vx = (dx / dist) * PROJECTILE_SPEED_PER_TICK;
    const vz = (dz / dist) * PROJECTILE_SPEED_PER_TICK;
    const projectile: Projectile = {
      id: this.nextProjectileId++,
      x: enemy.x,
      y: enemy.y,
      z: enemy.z,
      vx,
      vz,
      damage: PROJECTILE_DAMAGE,
      from: "enemy",
    };
    this.state.projectiles.push(projectile);
  }

  /** Advance every in-flight projectile by its velocity, collide it against
   *  the appropriate target (player for enemy-origin, enemies for
   *  player-origin), and prune anything that hit, hit a wall, or sailed off
   *  the map. Allocation-light: rebuilds the array only when at least one
   *  projectile died this tick. */
  private stepProjectiles(): void {
    if (this.state.projectiles.length === 0) return;
    const survivors: Projectile[] = [];
    let pruned = false;
    for (const pr of this.state.projectiles) {
      pr.x += pr.vx;
      pr.z += pr.vz;

      // Walls block projectiles — same predicate the player + enemies use.
      // `collidesAt` treats off-map cells as solid, so this also catches a
      // projectile that ran off the edge.
      if (collidesAt(pr.x, pr.z, 0)) {
        pruned = true;
        continue;
      }

      if (pr.from === "enemy") {
        // Hit the player? Floor-plane distance check against the player's
        // capsule (PLAYER_RADIUS).
        if (this.state.player.alive) {
          const dx = this.state.player.x - pr.x;
          const dz = this.state.player.z - pr.z;
          if (dx * dx + dz * dz <= PROJECTILE_HIT_RADIUS * PROJECTILE_HIT_RADIUS) {
            this.damagePlayer(pr.damage);
            pruned = true;
            continue;
          }
        }
      } else {
        // Player-origin: collide against the nearest live enemy in range.
        let hitIdx = -1;
        for (let i = 0; i < this.state.enemies.length; i++) {
          const e = this.state.enemies[i];
          if (e.state === "dead") continue;
          const dx = e.x - pr.x;
          const dz = e.z - pr.z;
          if (dx * dx + dz * dz <= PROJECTILE_HIT_RADIUS * PROJECTILE_HIT_RADIUS) {
            hitIdx = i;
            break;
          }
        }
        if (hitIdx >= 0) {
          this.damageEnemy(hitIdx, pr.damage);
          pruned = true;
          continue;
        }
      }

      survivors.push(pr);
    }
    if (pruned) this.state.projectiles = survivors;
  }

  /** Apply (or restore) the hit-flash emissive bump on an enemy's body
   *  meshes (#166). When `flashTicks > 0`, every `MeshStandardMaterial`
   *  under the group gets its emissive lerped toward white by
   *  `flashTicks / ENEMY_HIT_FLASH_TICKS`. When `flashTicks === 0`, we
   *  restore the snapshot baseline so the next flash starts clean. The
   *  baseline is captured the first time we touch a material, keyed by
   *  the material's uuid — shared materials snapshot once across the
   *  whole pool.
   *
   *  Pure presentation: the engine's contract is the simulation; this
   *  function only mutates THREE material color, never DoomState. */
  private applyHitFlashEmissive(
    group: THREE.Group,
    flashTicks: number,
  ): void {
    const k = flashTicks > 0 ? flashTicks / ENEMY_HIT_FLASH_TICKS : 0;
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      // Only MeshStandardMaterial carries `emissive` in the way we need.
      // Skip lights, helpers, and any material flavor without the field.
      if (!mat || !(mat as { emissive?: THREE.Color }).emissive) return;
      let baseline = this.emissiveBaselines.get(mat.uuid);
      if (!baseline) {
        baseline = mat.emissive.clone();
        this.emissiveBaselines.set(mat.uuid, baseline);
      }
      if (k > 0) {
        // Lerp baseline → white(1,1,1) by k. r = baseline.r + (1 - baseline.r) * k
        mat.emissive.setRGB(
          baseline.r + (1 - baseline.r) * k,
          baseline.g + (1 - baseline.g) * k,
          baseline.b + (1 - baseline.b) * k,
        );
      } else {
        mat.emissive.copy(baseline);
      }
    });
  }

  /** Sync the impact-spark mesh pool to `state.impactSparks` (#166). One
   *  visible mesh per live spark; extras hidden but kept in the pool for
   *  reuse on the next burst. Scale shrinks toward 0 over the spark's
   *  lifetime so the burst dissipates rather than snaps off.
   *
   *  Pure presentation — the simulation owns x/y/z/ticksLeft on the
   *  contract; this just mirrors them onto THREE.Mesh transforms. */
  private syncImpactSparkMeshes(): void {
    const sparks = this.state.impactSparks;
    // Lazy-build the shared geometry + material on first use.
    if (sparks.length > 0 && this.sparkGeometry === null) {
      // 0.04 world units is the spec's spark size — tiny enough to read as
      // a chip, not a fireball. 6 segments is the cheapest sphere that
      // doesn't read as a polygon at this scale.
      this.sparkGeometry = new THREE.SphereGeometry(0.04, 6, 6);
      this.sparkMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa44,
        // Full-bright bypass of lighting + fog so the spark POPS against
        // the dim corridor instead of getting eaten by the fog distance.
        fog: false,
      });
    }
    // Grow the pool to match. Cap pool growth at the live spark count —
    // once allocated, meshes stick around (visible toggled).
    while (
      this.sparkMeshes.length < sparks.length &&
      this.sparkGeometry &&
      this.sparkMaterial
    ) {
      const m = new THREE.Mesh(this.sparkGeometry, this.sparkMaterial);
      m.visible = false;
      this.scene.add(m);
      this.sparkMeshes.push(m);
    }
    // Position visible meshes; hide the tail of the pool.
    for (let i = 0; i < this.sparkMeshes.length; i++) {
      const m = this.sparkMeshes[i];
      const s = sparks[i];
      if (!s) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(s.x, s.y, s.z);
      // Linear scale shrink with remaining lifetime — at spawn 1.0, dies at 0.
      const k = Math.max(0, s.ticksLeft / IMPACT_SPARK_LIFETIME);
      m.scale.setScalar(k);
    }
  }

  /** Position the three.js camera at the player's eye + orient it from
   *  yaw/pitch. Called every render so the view tracks the player. */
  private syncCamera(): void {
    const p = this.state.player;
    // Screen shake (#91): while shakeTicks > 0, offset the camera by a small
    // deterministic perturbation that decays linearly with the remaining
    // ticks. Pure presentation — the simulation's player x/y/z are untouched,
    // so collision + AI see the unshaken position. The offset is a function
    // of tick + amplitude, not Math.random, so the same input sequence yields
    // the same shake (the determinism contract still holds).
    let ox = 0;
    let oy = 0;
    if (this.state.shakeTicks > 0) {
      const k = this.state.shakeTicks / SHAKE_TICKS; // 1 → 0
      const phase = this.state.tick;
      // Alternating sign per tick + cheap sinusoid for a non-linear wiggle.
      ox = Math.sin(phase * 1.7) * SHAKE_AMPLITUDE * k;
      oy = Math.cos(phase * 2.3) * SHAKE_AMPLITUDE * k;
    }
    // Connect-shake (#166): smaller, parallel beat to the damage shake.
    // Phase-shifted so the two don't sum into a single bigger wiggle when
    // both fire on the same tick (which can happen if your shot lands the
    // same frame an enemy melee hits you). Half amplitude per the issue's
    // HIT_SHAKE_AMPLITUDE_FACTOR; same SHAKE_AMPLITUDE scale.
    if (this.state.hitShakeTicks > 0) {
      const k2 = this.state.hitShakeTicks / HIT_SHAKE_TICKS;
      const phase2 = this.state.tick;
      ox +=
        Math.cos(phase2 * 2.1) *
        SHAKE_AMPLITUDE *
        HIT_SHAKE_AMPLITUDE_FACTOR *
        k2;
      oy +=
        Math.sin(phase2 * 1.9) *
        SHAKE_AMPLITUDE *
        HIT_SHAKE_AMPLITUDE_FACTOR *
        k2;
    }
    // Kill-shake (#194): the third, biggest beat — fires only on a killing
    // blow. Phase shift (1.3, 1.7) is distinct from damage (1.7/2.3) and
    // connect (2.1/1.9) so summing three concurrent channels doesn't beat-
    // frequency cancel into stillness. Envelope is k^2 — sharp punch up
    // front, then settles fast (not a flat linear fade, which would feel
    // mushy). Amplitude scales by KILL_SHAKE_AMPLITUDE_FACTOR (1.6).
    if (this.state.killShakeTicks > 0) {
      const k3 = this.state.killShakeTicks / KILL_SHAKE_TICKS;
      const env = k3 * k3;
      const phase3 = this.state.tick;
      ox +=
        Math.sin(phase3 * 1.3) *
        SHAKE_AMPLITUDE *
        KILL_SHAKE_AMPLITUDE_FACTOR *
        env;
      oy +=
        Math.cos(phase3 * 1.7) *
        SHAKE_AMPLITUDE *
        KILL_SHAKE_AMPLITUDE_FACTOR *
        env;
    }
    // Damage wobble (#205): slow horizontal sway that sells the daze AFTER
    // the initial damage THUNK. Linear amp decay (kw) — the LINGER, not a
    // second punch. Horizontal-only (no oy term): reads as "stumbled
    // sideways", not "head bobbing". 0.0314 rad/tick ≈ 0.3 Hz at 60 ticks/s,
    // distinct from the high-frequency phase rates of the three hard-shake
    // channels (1.3/1.7, 1.7/2.3, 2.1/1.9) — the four can fire concurrently
    // without beat-cancellation. Per #205, when damageWobbleTicks hits 0
    // the offset summed from this channel is 0 (kw=0), so the camera
    // returns to the player's eye exactly.
    if (this.state.damageWobbleTicks > 0) {
      const kw = this.state.damageWobbleTicks / DAMAGE_WOBBLE_TICKS;
      const phaseW = this.state.tick;
      ox +=
        Math.sin(phaseW * DAMAGE_WOBBLE_PHASE_RATE) *
        SHAKE_AMPLITUDE *
        DAMAGE_WOBBLE_AMPLITUDE_FACTOR *
        kw;
    }
    this.camera.position.set(p.x + ox, p.y + oy, p.z);
    // Euler order 'YXZ' = yaw (about world-up Y) then pitch (about local X) —
    // the standard FPS look order that avoids roll.
    this.camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
  }

  /** Match the renderer's drawing buffer to the canvas's displayed size, at
   *  the device pixel ratio (capped at 2 so high-DPI phones don't over-draw).
   *  Also refreshes the camera aspect. Called at construction + on resize. */
  private sizeRenderer(): void {
    const w = this.canvas.clientWidth || this.canvas.width || 960;
    const h = this.canvas.clientHeight || this.canvas.height || 540;
    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2,
    );
    this.renderer.setPixelRatio(dpr);
    // `false` = don't override the canvas's CSS size; only the drawing buffer.
    this.renderer.setSize(w, h, false);
  }

  /** Draw the scene through the player's camera. Pure presentation — reads the
   *  simulation, mutates nothing on the contract. */
  private render(): void {
    // Keep the buffer + aspect in sync with the (responsive) canvas.
    if (this.camera.aspect !== this.canvas.clientWidth / this.canvas.clientHeight) {
      this.sizeRenderer();
      const w = this.canvas.clientWidth || 960;
      const h = this.canvas.clientHeight || 540;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.syncCamera();
    // Sync surviving enemy meshes to their simulation positions, AND sync
    // each rig's active clip to the enemy's current AI state (#86). The
    // animation mixer is presentation: state lives in the simulation; the
    // rig just plays the clip that matches. State-change → setActiveClip
    // cross-fades; idle/walk/attack are looping, death is one-shot.
    //
    // ALSO apply the per-enemy hit-flash (#166): when hitFlashTicks>0,
    // multiply the body material's emissive toward white by the remaining
    // ticks / ENEMY_HIT_FLASH_TICKS. Restore the baseline when the flash
    // expires so the next hit starts from the model builder's resting tint.
    for (const e of this.state.enemies) {
      const mesh = this.enemyMeshes.get(e.id);
      if (mesh) mesh.position.set(e.x, e.y, e.z);
      const rig = this.enemyRigs.get(e.id);
      if (rig) {
        const want = clipNameForState(e.state);
        if (rig.active !== want) setActiveClip(rig, want);
      }
      if (mesh) this.applyHitFlashEmissive(mesh, e.hitFlashTicks);
      // Corpse alpha fade (#194, eased #356). During the last CORPSE_FADE
      // window of the dead beat, fade every standard material's opacity
      // from 1→0 so the body dissolves rather than snaps off when the cull
      // fires. The curve is easeInQuad (alpha = 1 - k²): the body holds
      // longer mid-window then accelerates into invisibility, so the final
      // transition dissolves INTO the floor instead of popping off it — a
      // linear ramp reads as a sprite-deletion frame at the tail. Endpoints
      // are identical to linear (k=0→1, k=1→0); timing is unchanged.
      // MeshStandardMaterial supports transparent+opacity; setting them late
      // (only when fading) means the live render path for alive enemies is
      // untouched.
      if (mesh && e.state === "dead") {
        const dt = e.deathTicks ?? 0;
        const alpha = corpseFadeAlpha(dt);
        // Only touch materials once the fade window has opened (alpha < 1).
        // Before that the corpse holds full opacity and the live render path
        // for the dead pose stays exactly as the model builder left it.
        if (alpha < 1) {
          mesh.traverse((obj) => {
            const m = (obj as THREE.Mesh).material as
              | THREE.Material
              | THREE.Material[]
              | undefined;
            if (!m) return;
            const apply = (mat: THREE.Material): void => {
              const std = mat as THREE.MeshStandardMaterial;
              if (std.opacity === undefined) return;
              std.transparent = true;
              std.opacity = alpha;
            };
            if (Array.isArray(m)) m.forEach(apply);
            else apply(m);
          });
        }
      }
    }
    // Maintain the impact-spark mesh pool (#166). One mesh per live spark,
    // positioned at the simulation's world coords; extras hidden. Lazy-
    // builds geometry + material on first spawn so boot stays cheap.
    this.syncImpactSparkMeshes();
    // Maintain the blood-drop mesh pool (#194). Same pattern as sparks
    // but a separate pool because the geometry/material differ (larger,
    // dark red, fog-affected).
    this.syncBloodDropMeshes();
    // Advance every mixer by the wall-clock delta — animation is decoupled
    // from the fixed-step sim (no determinism contract on visual easing).
    // One shared THREE.Clock yields a delta that excludes time spent in
    // background tabs, so a returning player doesn't see a giant skip.
    const dt = this.animClock.getDelta();
    if (dt > 0) {
      for (const rig of this.enemyRigs.values()) rig.mixer.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Publish a fresh snapshot of the contract onto window.__doom. The HUD +
   *  tests all read THIS, never the engine internals. */
  private publish(): void {
    window.__doom = this.state;
  }
}
