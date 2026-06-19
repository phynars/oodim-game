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
  HP_BY_KIND,
  initialState,
  PLAYER_SHOT_DAMAGE,
  SCORE_BY_KIND,
  type DoomState,
  type Enemy,
  type EnemyKind,
  type ShotRecord,
} from "./types";
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
  collidesAt,
  findSpawn,
  MAP_HEIGHT,
  MAP_WIDTH,
  WALL_HEIGHT,
  walls,
} from "./level";

/** Fixed timestep: 60 logical updates/sec, decoupled from render rAF. The
 *  simulation advances in whole STEP_MS chunks via an accumulator so game
 *  logic is deterministic regardless of display refresh rate. */
const STEP_MS = 1000 / 60;

/** Maximum world-distance a hitscan ray travels before counting as a miss.
 *  Larger than the arena's diagonal so the only way to miss is to not be
 *  aimed at an enemy — the wall geometry naturally blocks farther shots if
 *  added to the ray target list later (the scaffold raycasts ONLY against
 *  live enemy meshes; walls don't block-shots-into-them yet, which is fine
 *  for this slice — the contract is "shot at enemy = hit"). */
const WEAPON_MAX_RANGE = 100;

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

/** Visual size (world units) of a placeholder enemy box, per archetype — barons
 *  read as the biggest threat. Purely cosmetic; combat uses HP_BY_KIND. */
const ENEMY_BOX_SIZE: Record<EnemyKind, number> = {
  imp: 0.8,
  demon: 1.1,
  baron: 1.6,
};

/** Placeholder enemy colors by archetype. Generic palette — no id Software
 *  art. Imps warm, demons hot pink, barons a heavy red. */
const ENEMY_COLOR: Record<EnemyKind, number> = {
  imp: 0xc89b6a,
  demon: 0xff5aa0,
  baron: 0xcc3333,
};

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
  /** Per-enemy placeholder mesh, keyed by enemy id — so the render pass can
   *  sync mesh transforms to the simulation's enemy positions + cull dead
   *  ones. */
  private readonly enemyMeshes: Map<number, THREE.Mesh> = new Map();

  /** Tick at which status flipped to 'lost'. After GAMEOVER_HOLD_FRAMES more
   *  fixed-step frames elapse the status advances to 'gameover'. Null while
   *  still playing (mirrors Galaga's two-step death). */
  private lostTick: number | null = null;
  /** Fixed-step frames accumulated since status flipped to 'lost'. Counted
   *  independently of state.tick because state.tick freezes once we leave
   *  'playing' (it's the in-game clock, not real time). */
  private gameOverFrames = 0;

  // Fixed-step accumulator state (see start()).
  private lastTime = 0;
  private accumulator = 0;

  /** Reusable Raycaster for hitscan fire. One instance lives on the engine so
   *  we don't allocate per shot — `set(origin, direction)` re-aims it. */
  private readonly raycaster: THREE.Raycaster = new THREE.Raycaster();

  /** TEST-ONLY forced-input override. When non-null, update() reads movement
   *  from THIS snapshot instead of the live keyboard, letting the `advance`
   *  hook (see exposeInternals) drive deterministic, wall-clock-free movement.
   *  Always null during real play — gameplay code never sets it. */
  private forcedInput: InputSnapshot | null = null;
  /** TEST-ONLY forced fire flag, consumed exactly once. Set by `advance({fire:
   *  true})` for the first forced step so the harness can pull the trigger
   *  deterministically without going through the keyboard's edge-triggered
   *  consumeFire (which the forced-input path bypasses). */
  private forcedFire = false;

  /** Reusable Raycaster — created once, aimed per-shot. three.js encourages
   *  reusing the instance to avoid GC churn in a tight loop. */
  private readonly raycaster = new THREE.Raycaster();

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
    // A touch of fog hides the far plane pop-in and sells the murky interior.
    this.scene.fog = new THREE.Fog(0x0a0a0f, 8, 60);

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

    // Lights: a soft ambient fill so nothing is pure black, plus a directional
    // "sun" for shape. The scaffold doesn't do dynamic lighting (a backlog
    // polish slice); this is enough to read the floor + enemy boxes.
    this.scene.add(new THREE.AmbientLight(0x404050, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);

    // Floor — a plane spanning the arena, rotated flat (PlaneGeometry is built
    // in the XY plane; rotate -90° about X to lay it in XZ at y=0). Sized from
    // the level map so the floor exactly underlays the walkable cells.
    const floorGeo = new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a38,
      roughness: 1,
      metalness: 0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // Build wall meshes from the level map (issue #75). One box per solid
    // cell, sized CELL × WALL_HEIGHT × CELL, centered at the cell's world
    // position. Geometry + material are shared across walls — every solid
    // cell renders identically, and disposing them is a no-op for the scene
    // lifecycle (the engine outlives the level for now).
    const wallGeo = new THREE.BoxGeometry(2, WALL_HEIGHT, 2);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a5a,
      roughness: 0.9,
      metalness: 0,
    });
    for (const w of walls()) {
      const mesh = new THREE.Mesh(wallGeo, wallMat);
      mesh.position.set(w.x, WALL_HEIGHT / 2, w.z);
      this.scene.add(mesh);
    }

    // Seed the enemy roster + a placeholder box mesh per enemy.
    this.seedEnemies();

    // Keyboard is the canonical input. First keydown flips ready→playing.
    this.input = createKeyboardInput();

    this.publish();
    this.bindInput();
    this.exposeInternals();
  }

  /** Seed the simulation's enemy roster from SEED_ENEMIES, and build a
   *  placeholder BoxGeometry mesh for each so the scene renders something
   *  the moment WebGL comes up. */
  private seedEnemies(): void {
    let nextId = 1;
    for (const seed of SEED_ENEMIES) {
      const id = nextId++;
      const size = ENEMY_BOX_SIZE[seed.kind];
      const enemy: Enemy = {
        id,
        kind: seed.kind,
        x: seed.x,
        // Box sits ON the floor: its center is half its height above y=0.
        y: size / 2,
        z: seed.z,
        hp: HP_BY_KIND[seed.kind],
        state: "idle",
      };
      this.state.enemies.push(enemy);

      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color: ENEMY_COLOR[seed.kind],
        roughness: 0.7,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(enemy.x, enemy.y, enemy.z);
      this.scene.add(mesh);
      this.enemyMeshes.set(id, mesh);
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
        this.damageEnemy(idx, PLAYER_SHOT_DAMAGE);
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
        }
        this.publish();
      },
    };
  }

  /** Fire the equipped weapon: hitscan raycast from the camera, find the
   *  nearest live enemy mesh under the crosshair, decrement ammo, and record
   *  the shot on the contract. At ammo=0 the trigger is a no-op (no shot, no
   *  lastShot update) — out-of-ammo is observable by ammo===0, not by a
   *  phantom miss. Centralized so live Space-fire AND the `forceFire` hook
   *  take exactly the same path. */
  private tryFire(): void {
    const w = this.state.weapon;
    if (w.ammo <= 0) return;
    w.ammo -= 1;

    // Origin = camera (the player's eye). Direction = the camera's forward
    // axis, derived from its current world quaternion so it always matches
    // what the player sees, regardless of yaw/pitch encoding. Three.js's
    // default camera looks down -Z in local space, so the world forward is
    // (0,0,-1) transformed by the camera's quaternion.
    this.syncCamera();
    const origin = new THREE.Vector3().copy(this.camera.position);
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion)
      .normalize();
    this.raycaster.set(origin, direction);
    this.raycaster.near = 0;
    this.raycaster.far = WEAPON_MAX_RANGE;

    // Raycast ONLY against live enemy meshes. Walls don't block this slice —
    // adding wall occlusion is a follow-up. `recursive=false` because each
    // enemy is a single Mesh, not a group.
    const meshes = Array.from(this.enemyMeshes.values());
    const hits = this.raycaster.intersectObjects(meshes, false);

    let hitEnemyId: number | null = null;
    let hitX: number | null = null;
    let hitY: number | null = null;
    let hitZ: number | null = null;
    if (hits.length > 0) {
      const first = hits[0];
      // Resolve mesh → enemy id by scanning the map (small N, no allocation).
      for (const [id, mesh] of this.enemyMeshes) {
        if (mesh === first.object) {
          hitEnemyId = id;
          break;
        }
      }
      hitX = first.point.x;
      hitY = first.point.y;
      hitZ = first.point.z;
      if (hitEnemyId !== null) {
        const idx = this.state.enemies.findIndex((e) => e.id === hitEnemyId);
        if (idx >= 0) this.damageEnemy(idx, PLAYER_SHOT_DAMAGE);
      }
    }

    this.state.lastShot = {
      tick: this.state.tick,
      enemyId: hitEnemyId,
      hitX,
      hitY,
      hitZ,
    };
  }

  /** Deal `damage` to the enemy at `idx`. On lethal damage the enemy flips to
   *  'dead', its score is awarded, and its mesh is removed from the scene.
   *  Centralized so the forceHit hook and the (future) projectile-collision
   *  pass take the same path. */
  private damageEnemy(idx: number, damage: number): void {
    const e = this.state.enemies[idx];
    if (!e || e.state === "dead") return;
    e.hp -= damage;
    if (e.hp <= 0) {
      e.hp = 0;
      e.state = "dead";
      this.state.score += SCORE_BY_KIND[e.kind];
      // Drop the placeholder mesh — a dead enemy leaves the scene. (The death
      // VFX / corpse is a backlog polish slice.)
      const mesh = this.enemyMeshes.get(e.id);
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.enemyMeshes.delete(e.id);
      }
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
  }

  /** First input leaves the READY state; once playing, the loop ticks.
   *  Keyboard goes through the InputSource (so its onFirstInput hook fires the
   *  flip); pointerdown on the canvas is a separate path for click/tap on the
   *  READY screen AND is where we ask the browser for pointer-lock (must be a
   *  user-gesture handler). */
  private bindInput(): void {
    const start = (): void => {
      if (this.state.status === "ready") this.state.status = "playing";
    };
    this.input.onFirstInput(start);
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
      this.render();
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
      // Sample input once per fixed-step so movement is deterministic at 60 Hz
      // regardless of render cadence. consumeFire() / consumeMouseDelta() are
      // drained per tick so input doesn't pile up across frames.
      //
      // TEST-ONLY: when the `advance` hook has set a forced-input override we
      // read movement from it instead of the live keyboard (and skip mouselook)
      // so the harness gets frame-rate-independent travel. forcedInput is null
      // in all real play — see the field decl + exposeInternals().
      const snap = this.forcedInput ?? this.input.read();
      const wantsFire = this.input.consumeFire();
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

      // --- FIRE -----------------------------------------------------------
      // Hitscan: edge-triggered Space (or pointerdown — wired through the same
      // consumeFire() path on a future input slice) fires the equipped weapon
      // once. tryFire() handles ammo / raycast / lastShot publication.
      if (wantsFire) this.tryFire();

      // Cull enemies that finished their death frame. Keeping a 'dead' enemy
      // for exactly the tick it died lets a consumer observe the transition;
      // we drop it on the following tick.
      if (this.state.enemies.some((e) => e.state === "dead")) {
        this.state.enemies = this.state.enemies.filter(
          (e) => e.state !== "dead",
        );
      }
    }
  }

  /** Position the three.js camera at the player's eye + orient it from
   *  yaw/pitch. Called every render so the view tracks the player. */
  private syncCamera(): void {
    const p = this.state.player;
    this.camera.position.set(p.x, p.y, p.z);
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
    // Sync surviving enemy meshes to their simulation positions (no-op in the
    // static scaffold, but keeps the render pass correct once AI moves them).
    for (const e of this.state.enemies) {
      const mesh = this.enemyMeshes.get(e.id);
      if (mesh) mesh.position.set(e.x, e.y, e.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Publish a fresh snapshot of the contract onto window.__doom. The HUD +
   *  tests all read THIS, never the engine internals. */
  private publish(): void {
    window.__doom = this.state;
  }
}
