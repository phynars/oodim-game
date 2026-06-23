// First-person weapon viewmodel (issue #87) — a code-built low-poly mesh
// fixed to the camera so it reads as the player's hands+gun in the lower-
// right of the view. No external assets: a few boxes assembled into a
// pistol silhouette (grip + slide + barrel + sight rib) sized to read at
// the camera's 75° FOV without dominating the frame.
//
// PARENTING: the engine adds the returned Group as a CHILD of the camera
// (`camera.add(group)`), so the viewmodel inherits the camera's world
// transform automatically — no per-frame syncCamera write needed. The
// group's LOCAL position places it just below + ahead of the eye in
// camera-local space:
//   +x right of the screen, +y up, -z forward (into the scene).
// We want the gun in the lower-right, just in front of the near plane.
//
// MUZZLE FLASH: the group includes a small dim PointLight + an emissive
// sprite plane positioned at the barrel tip. Both are hidden by default
// (intensity 0 / visible false) and the engine pulses them ON for a few
// fixed-step ticks after every shot — see `pulseMuzzleFlash` below.
//
// RECOIL/BOB: a tiny per-shot kick on local z (the gun pops back toward
// the camera) decays on a timer; the engine drives the timer from the
// fixed-step loop so determinism stays intact (no wall-clock easing in
// the simulation path). The idle/walk bob (Diego audit, juice ceiling
// #21) couples bob FREQUENCY and AMPLITUDE to player speed: at rest the
// gun breathes slow + tiny Y-only; in motion it swaggers at footstep
// cadence with a figure-eight (sin on Y, cos on X) so the body's actual
// state EARNS the feedback. Phase accumulates continuously across the
// transition so resumption is graceful (no snap on start/stop).

import * as THREE from "three";

/** Frames the muzzle flash remains visible after a shot. ~5 ticks @60Hz =
 *  ~83ms — long enough to read as a flash, short enough not to linger. */
export const MUZZLE_FLASH_TICKS = 5;

/** Frames the per-shot recoil takes to decay back to rest. The recoil
 *  amplitude (world units along local +z) eases from RECOIL_KICK to 0
 *  over this many ticks; the engine drives it from the fixed-step loop
 *  so it's deterministic. */
export const RECOIL_DECAY_TICKS = 10;

/** Local-z displacement applied at the moment of fire (toward the camera).
 *  Small — the muzzle stays visible — but enough to read as a kick. */
const RECOIL_KICK = 0.04;

// --- Bob coupling (Diego audit, juice ceiling #21) -------------------
//
// The bob is a SUM of two channels lerped on speedFrac = vel/maxVel:
//   - At rest (speedFrac=0): slow breath, Y-only, tiny amplitude.
//   - At full motion (speedFrac=1): footstep cadence on Y + lateral
//     figure-8 on X (scaled directly by speedFrac so it's zero at rest
//     — no spurious idle wiggle).
//
// Phase ADVANCES at the BLENDED FREQUENCY each tick — never resets on
// motion start/stop, so the cadence resumes gracefully.
/** Bob phase advance per tick at rest. ~2.9× slower than the previous
 *  flat 0.08 — reads as a breath, not a stride. */
const IDLE_BOB_FREQ = 0.03;
/** Bob phase advance per tick at full speed. Footstep cadence. */
const WALK_BOB_FREQ = 0.16;
/** Bob amplitude on local-y at rest. Subtle breath. */
const IDLE_BOB_AMP_Y = 0.003;
/** Bob amplitude on local-y at full speed. Visible weight shift. */
const WALK_BOB_AMP_Y = 0.012;
/** Bob amplitude on local-x at full speed (lateral sway).
 *  Scales DIRECTLY by speedFrac — zero at rest. */
const WALK_BOB_AMP_X = 0.008;

/** Base local-space anchor for the viewmodel in camera-local coords. The
 *  gun sits to the right of the screen, below the eye, just in front of
 *  the near plane so it never z-fights with the world. */
const BASE_X = 0.18;
const BASE_Y = -0.16;
const BASE_Z = -0.4;

/** A self-contained viewmodel: the THREE.Group to parent on the camera,
 *  the muzzle-flash visual handles (light + sprite plane), and the
 *  per-fire pulse state the engine ticks down. */
export interface Viewmodel {
  /** The root group — engine calls `camera.add(group)` once at boot. */
  group: THREE.Group;
  /** PointLight at the muzzle. Intensity is 0 at rest, pulsed to FLASH_LIGHT_INTENSITY on fire. */
  flashLight: THREE.PointLight;
  /** Emissive sprite plane at the muzzle — visible during a flash, hidden otherwise. */
  flashSprite: THREE.Mesh;
  /** Fixed-step frames remaining on the current muzzle-flash pulse. >0
   *  means the flash is visible THIS tick. Mirrored onto __doom.weapon
   *  by the engine each publish, so the e2e harness can assert the
   *  pulse without reaching into three.js. */
  flashTicks: number;
  /** Fixed-step frames remaining on the current recoil kick. Decays the
   *  local-z offset from RECOIL_KICK→0 linearly. */
  recoilTicks: number;
  /** Bob phase accumulator. Advances by a SPEED-BLENDED frequency each
   *  fixed update; render pass takes sin(phase) for local-y and
   *  cos(phase/2) for the lateral channel. */
  bobPhase: number;
}

/** Build the viewmodel mesh. Returns a Group of merged primitives in
 *  CAMERA-LOCAL space (so once parented to the camera, it sits at the
 *  base anchor automatically). The geometry budget is intentionally
 *  small — six meshes total — to match the rest of the doom scene's
 *  "low-poly silhouette" aesthetic. */
export function buildViewmodel(): Viewmodel {
  const group = new THREE.Group();
  group.name = "weapon-viewmodel";
  // Render the viewmodel AFTER the world so it never z-fights with
  // distant geometry. renderOrder bumps draw order without changing depth.
  group.renderOrder = 999;
  group.position.set(BASE_X, BASE_Y, BASE_Z);

  // Materials are dedicated to the viewmodel — no sharing with world
  // meshes, so disposing one wouldn't affect the other. The whole
  // viewmodel lives for the engine's lifetime, so we don't dispose it.
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x444448,
    roughness: 0.5,
    metalness: 0.7,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a14,
    roughness: 0.9,
    metalness: 0.0,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x222226,
    roughness: 0.4,
    metalness: 0.8,
  });

  // Grip — angled box pointing down/back, the part the "hand" holds.
  const gripGeo = new THREE.BoxGeometry(0.04, 0.12, 0.05);
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.set(0, -0.04, 0.02);
  grip.rotation.x = 0.25;
  group.add(grip);

  // Slide — the body of the pistol, on top of the grip.
  const slideGeo = new THREE.BoxGeometry(0.05, 0.045, 0.14);
  const slide = new THREE.Mesh(slideGeo, metalMat);
  slide.position.set(0, 0.025, -0.04);
  group.add(slide);

  // Barrel — thinner box extending forward of the slide.
  const barrelGeo = new THREE.BoxGeometry(0.025, 0.025, 0.06);
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(0, 0.025, -0.135);
  group.add(barrel);

  // Sight rib — tiny block on top of the slide so the silhouette has a
  // distinct top edge.
  const sightGeo = new THREE.BoxGeometry(0.01, 0.008, 0.08);
  const sight = new THREE.Mesh(sightGeo, metalMat);
  sight.position.set(0, 0.052, -0.04);
  group.add(sight);

  // --- Muzzle flash --------------------------------------------------
  // World position of the muzzle tip = barrel center + half its length
  // along -z, in viewmodel-local space.
  const muzzleZ = -0.18;

  // PointLight: short-range, bright when on. Intensity 0 at rest; the
  // engine pulses it to FLASH_LIGHT_INTENSITY on fire.
  const flashLight = new THREE.PointLight(0xffd070, 0, 3, 2);
  flashLight.position.set(0, 0.025, muzzleZ);
  group.add(flashLight);

  // Sprite plane — a small emissive quad facing the camera. Hidden by
  // default; visible during a pulse. We use a Mesh with
  // MeshBasicMaterial (not Sprite) so it sits cleanly in the viewmodel's
  // transform hierarchy and is always-on-top via depthTest:false.
  const flashGeo = new THREE.PlaneGeometry(0.08, 0.08);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffe080,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const flashSprite = new THREE.Mesh(flashGeo, flashMat);
  flashSprite.position.set(0, 0.025, muzzleZ - 0.01);
  flashSprite.visible = false;
  // renderOrder does NOT inherit from parent groups in three.js — it must
  // be set on the leaf object itself. The group-level renderOrder above
  // is a no-op (Group has no draw call); the flash needs its own override
  // so its always-on-top depthTest:false pairs with a late draw position
  // in the transparent sort, otherwise opaque slide/barrel can paint over
  // the flash when it pulses.
  flashSprite.renderOrder = 999;
  group.add(flashSprite);

  return {
    group,
    flashLight,
    flashSprite,
    flashTicks: 0,
    recoilTicks: 0,
    bobPhase: 0,
  };
}

/** Light intensity during a flash pulse. Reset to 0 once flashTicks hits 0. */
const FLASH_LIGHT_INTENSITY = 4;

/** Trigger one muzzle-flash pulse + recoil kick. Called by the engine in
 *  the SAME synchronous fireShot() path that decrements ammo + raycasts,
 *  so the published state reflects the flash in the same tick. */
export function pulseMuzzleFlash(vm: Viewmodel): void {
  vm.flashTicks = MUZZLE_FLASH_TICKS;
  vm.recoilTicks = RECOIL_DECAY_TICKS;
  vm.flashLight.intensity = FLASH_LIGHT_INTENSITY;
  vm.flashSprite.visible = true;
  // Rotate the sprite a random multiple of 90° per pulse so consecutive
  // flashes don't read as the same fixed quad. Deterministic input not
  // required here — this is presentation, not simulation state.
  vm.flashSprite.rotation.z = Math.floor(Math.random() * 4) * (Math.PI / 2);
}

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Advance the viewmodel's per-tick state — recoil decay, bob phase,
 *  flash countdown. Called once per fixed-step from Engine.update(), so
 *  all easing is deterministic (no wall-clock reads).
 *
 *  @param speedFrac player speed normalized to [0,1] (vel/maxVel). The
 *    engine passes this from its move state; bob frequency and amplitude
 *    lerp on this fraction. Defaults to 0 (idle) so older callers that
 *    haven't been updated keep the breath-at-rest behavior. */
export function stepViewmodel(vm: Viewmodel, speedFrac: number = 0): void {
  // Clamp defensively — out-of-range speedFrac would distort the lerp.
  const s = speedFrac < 0 ? 0 : speedFrac > 1 ? 1 : speedFrac;

  // Phase advances at the BLENDED frequency. Continuous across motion
  // start/stop — no reset — so cadence resumes gracefully.
  const freq = lerp(IDLE_BOB_FREQ, WALK_BOB_FREQ, s);
  vm.bobPhase += freq;

  if (vm.flashTicks > 0) {
    vm.flashTicks -= 1;
    if (vm.flashTicks <= 0) {
      vm.flashTicks = 0;
      vm.flashLight.intensity = 0;
      vm.flashSprite.visible = false;
    }
  }

  if (vm.recoilTicks > 0) {
    vm.recoilTicks -= 1;
  }

  // Apply transform: recoil kicks the gun toward the camera on local +z
  // (positive z = back toward viewer in our basis), decaying linearly.
  // Bob is a speed-blended Y channel + a lateral X channel that's zero
  // at rest (figure-eight feel: full Y cycle, half-rate X cycle).
  const recoilFrac = vm.recoilTicks / RECOIL_DECAY_TICKS;
  const recoilOffset = RECOIL_KICK * recoilFrac;
  const ampY = lerp(IDLE_BOB_AMP_Y, WALK_BOB_AMP_Y, s);
  const ampX = WALK_BOB_AMP_X * s;
  const bobY = Math.sin(vm.bobPhase) * ampY;
  const bobX = Math.cos(vm.bobPhase * 0.5) * ampX;
  vm.group.position.set(BASE_X + bobX, BASE_Y + bobY, BASE_Z + recoilOffset);
}
