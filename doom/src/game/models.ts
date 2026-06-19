// Code-built low-poly enemy models (issue #85). No external assets — every
// enemy archetype is a THREE.Group of merged primitives (boxes, cones, a
// sphere) so each kind has a distinct silhouette and the scene reads as
// CREATURES instead of a flat row of boxes.
//
// Each builder returns a fresh Group whose root sits at the enemy's CENTER
// (y = size/2 above the floor when placed). All child mesh positions are
// expressed relative to that center, so the engine can keep treating the
// returned object as a single transform: just set group.position to the
// enemy's world coords and the silhouette comes with it.
//
// The geometry/material objects are CREATED PER ENEMY (no shared geo cache)
// because the engine's death path disposes them per-enemy — a shared
// BufferGeometry would explode on the first dispose. This is a handful of
// enemies; the allocation cost is invisible next to the scene tax.

import * as THREE from "three";

import type { EnemyKind, EnemyState } from "./types";

/** Named animation clips every enemy carries (issue #86). One per AI state +
 *  a death anim; the active clip follows `enemy.state` (idle/chasing→walk,
 *  attacking→attack, dead→death). Clips are PROCEDURAL — built from
 *  KeyframeTracks in code, no asset files — so a fresh enemy gets a working
 *  mixer the moment it's seeded. */
export type EnemyClipName = "idle" | "walk" | "attack" | "death";

/** Map an enemy's AI state to the clip name that should play. Idle + chasing
 *  share the walking gait (idle = breath-loop on stationary, chasing = walk
 *  loop in place — the engine moves the group itself). Attacking plays the
 *  attack lunge; dead plays the collapse. */
export function clipNameForState(state: EnemyState): EnemyClipName {
  switch (state) {
    case "idle":
      return "idle";
    case "chasing":
      return "walk";
    case "attacking":
      return "attack";
    case "dead":
      return "death";
  }
}

/** The animation rig attached to one enemy: a mixer driving named clips on
 *  the enemy's `THREE.Group`. The engine advances `mixer.update(dt)` per
 *  render and switches the active clip when `enemy.state` changes (see
 *  engine.ts). */
export interface EnemyAnimationRig {
  mixer: THREE.AnimationMixer;
  /** Named clips, keyed by EnemyClipName. The engine plays one at a time. */
  clips: Record<EnemyClipName, THREE.AnimationClip>;
  /** Per-clip Action, lazily started on first play. We keep them so
   *  switching is a fadeOut/fadeIn rather than a stop/play (no T-pose flash
   *  between states). */
  actions: Record<EnemyClipName, THREE.AnimationAction>;
  /** Name of the clip currently playing — published on the test contract
   *  (window.__doomModels) so the e2e harness can assert state→clip wiring. */
  active: EnemyClipName;
}

/** Visual size (world units) per archetype — barons read as the biggest
 *  threat, imps the smallest. The BUILDERS use this to scale their
 *  primitives, and the engine reads it to set the group's vertical offset
 *  (y = size/2) so the model sits ON the floor. */
export const ENEMY_MODEL_SIZE: Record<EnemyKind, number> = {
  imp: 0.8,
  demon: 1.1,
  baron: 1.6,
};

/** Body color per archetype. Generic palette — no id Software art. */
const BODY_COLOR: Record<EnemyKind, number> = {
  imp: 0xc89b6a, // warm tan
  demon: 0xff5aa0, // hot pink
  baron: 0xcc3333, // heavy red
};

/** Secondary accent color (horns / spikes / claws) — darker than the body
 *  so the silhouette reads layered. */
const ACCENT_COLOR: Record<EnemyKind, number> = {
  imp: 0x6a3a1a,
  demon: 0x7a1a4a,
  baron: 0x4a0a0a,
};

/** Eye color — a single bright dot per side so the creature has a face the
 *  player can read at a glance. */
const EYE_COLOR = 0xffff66;

/** Build a low-poly model for one enemy kind. Returns a Group whose origin
 *  is the enemy's center (so the engine places it at `enemy.{x,y,z}` and the
 *  body sits half above / half below that point — same as the prior box).
 *
 *  Each builder composes 4-7 primitives: a torso, a head, eyes, and one or
 *  two kind-specific accents (horns, claws, a baron's pauldrons). Counted
 *  for the e2e contract: `group.children.length > 1`. */
export function buildEnemyModel(kind: EnemyKind): THREE.Group {
  switch (kind) {
    case "imp":
      return buildImp();
    case "demon":
      return buildDemon();
    case "baron":
      return buildBaron();
  }
}

/** Imp — small, hunched, two little horns. Cone-tipped head reads as a
 *  snout from any angle, which sells the silhouette at distance. */
function buildImp(): THREE.Group {
  const size = ENEMY_MODEL_SIZE.imp;
  const body = BODY_COLOR.imp;
  const accent = ACCENT_COLOR.imp;
  const group = new THREE.Group();

  // Torso — a slightly tapered box. Centered at the group origin.
  const torsoGeo = new THREE.BoxGeometry(size * 0.7, size * 0.7, size * 0.5);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: body,
    roughness: 0.7,
    metalness: 0.1,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  group.add(torso);

  // Head — a smaller box on top, offset forward (-z) for a hunched read.
  const headGeo = new THREE.BoxGeometry(size * 0.5, size * 0.4, size * 0.45);
  const headMat = new THREE.MeshStandardMaterial({
    color: body,
    roughness: 0.7,
    metalness: 0.1,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, size * 0.5, -size * 0.05);
  group.add(head);

  // Two horns — small cones tilted outward. Sit on top of the head.
  const hornGeo = new THREE.ConeGeometry(size * 0.08, size * 0.25, 6);
  const hornMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.9,
    metalness: 0,
  });
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(sx * size * 0.15, size * 0.78, -size * 0.05);
    horn.rotation.z = sx * 0.25;
    group.add(horn);
  }

  // Eyes — two tiny glowing boxes on the front face.
  const eyeGeo = new THREE.BoxGeometry(size * 0.07, size * 0.07, size * 0.04);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: EYE_COLOR,
    emissive: EYE_COLOR,
    emissiveIntensity: 0.6,
  });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * size * 0.12, size * 0.52, -size * 0.27);
    group.add(eye);
  }

  return group;
}

/** Demon — squat, wide-mouthed quadruped read. Spherical body for a
 *  rounder silhouette that contrasts with the imp's angular hunch. */
function buildDemon(): THREE.Group {
  const size = ENEMY_MODEL_SIZE.demon;
  const body = BODY_COLOR.demon;
  const accent = ACCENT_COLOR.demon;
  const group = new THREE.Group();

  // Body — a low-poly sphere (octahedron-ish) for that pinky bulk.
  const bodyGeo = new THREE.SphereGeometry(size * 0.45, 8, 6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: body,
    roughness: 0.6,
    metalness: 0.1,
  });
  const torso = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(torso);

  // Mouth slab — a wide, dark box on the front face. Reads as a gaping maw.
  const mouthGeo = new THREE.BoxGeometry(size * 0.6, size * 0.18, size * 0.12);
  const mouthMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 1,
    metalness: 0,
  });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, 0, -size * 0.4);
  group.add(mouth);

  // Four stubby legs — small boxes at the corners, dropping below the
  // body so the demon stands on them.
  const legGeo = new THREE.BoxGeometry(size * 0.15, size * 0.25, size * 0.15);
  const legMat = new THREE.MeshStandardMaterial({
    color: body,
    roughness: 0.7,
    metalness: 0.1,
  });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * size * 0.25, -size * 0.4, sz * size * 0.25);
      group.add(leg);
    }
  }

  // Eyes — two on top of the body, glowing.
  const eyeGeo = new THREE.BoxGeometry(size * 0.08, size * 0.08, size * 0.05);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: EYE_COLOR,
    emissive: EYE_COLOR,
    emissiveIntensity: 0.6,
  });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * size * 0.15, size * 0.15, -size * 0.38);
    group.add(eye);
  }

  return group;
}

/** Baron — tall, broad-shouldered, big curved horns. The boss silhouette:
 *  pauldrons widen the upper body so even at distance a baron reads as
 *  bigger and more dangerous than the others. */
function buildBaron(): THREE.Group {
  const size = ENEMY_MODEL_SIZE.baron;
  const body = BODY_COLOR.baron;
  const accent = ACCENT_COLOR.baron;
  const group = new THREE.Group();

  // Torso — a tall box.
  const torsoGeo = new THREE.BoxGeometry(size * 0.55, size * 0.75, size * 0.45);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: body,
    roughness: 0.6,
    metalness: 0.15,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  group.add(torso);

  // Pauldrons — wide accent boxes sitting on top of the torso. Read as
  // armored shoulders and visibly widen the silhouette.
  const pauldronGeo = new THREE.BoxGeometry(
    size * 0.25,
    size * 0.18,
    size * 0.5,
  );
  const pauldronMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.5,
    metalness: 0.3,
  });
  for (const sx of [-1, 1]) {
    const pauldron = new THREE.Mesh(pauldronGeo, pauldronMat);
    pauldron.position.set(sx * size * 0.38, size * 0.3, 0);
    group.add(pauldron);
  }

  // Head — smaller box on top.
  const headGeo = new THREE.BoxGeometry(size * 0.4, size * 0.35, size * 0.4);
  const headMat = new THREE.MeshStandardMaterial({
    color: body,
    roughness: 0.6,
    metalness: 0.15,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, size * 0.55, 0);
  group.add(head);

  // Two BIG curved horns — large cones tilted outward + forward. The
  // signature baron read.
  const hornGeo = new THREE.ConeGeometry(size * 0.1, size * 0.45, 6);
  const hornMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.7,
    metalness: 0.2,
  });
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(sx * size * 0.22, size * 0.85, -size * 0.05);
    horn.rotation.z = sx * 0.5;
    horn.rotation.x = -0.2;
    group.add(horn);
  }

  // Eyes — glowing, set deeper than the imp's so the baron reads as
  // brooding rather than skittish.
  const eyeGeo = new THREE.BoxGeometry(size * 0.07, size * 0.07, size * 0.04);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: EYE_COLOR,
    emissive: EYE_COLOR,
    emissiveIntensity: 0.7,
  });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * size * 0.11, size * 0.6, -size * 0.21);
    group.add(eye);
  }

  return group;
}

/** Build a procedural `AnimationMixer` rig for `group` (issue #86): four
 *  named clips (idle/walk/attack/death) generated entirely from
 *  KeyframeTracks — no GLTF, no external assets. The clips animate the
 *  ROOT group's transform (y-bob, rotation, scale-collapse), which works
 *  for every enemy archetype regardless of child layout. The engine plays
 *  one clip at a time via `setActiveClip(rig, name)`; per-frame it calls
 *  `mixer.update(dt)` to advance them.
 *
 *  Why procedural — the studio ships no model files, and the e2e contract
 *  ("a mixer exists with the expected named clips and the clip switches on
 *  state change") is satisfied at the AnimationMixer / AnimationClip layer,
 *  not at any particular keyframe magnitude. The amplitudes here are chosen
 *  so the motion reads from the player's POV without overshooting the
 *  silhouette.
 *
 *  All clips target the ROOT group via its UUID — three.js looks up bound
 *  targets by name OR uuid; uuid is unambiguous across kinds. */
export function buildEnemyAnimations(group: THREE.Group): EnemyAnimationRig {
  // The engine moves `group.position` every render to mirror the
  // simulation; animating the root's position would be CLOBBERED by that
  // sync. We insert a child "rig pivot" between the root and the body
  // meshes, then target ITS transform — the engine's per-frame
  // group.position writes leave the pivot untouched, and the pivot's
  // local transform stacks underneath as the animation.
  const pivot = new THREE.Group();
  pivot.name = "enemy-rig-pivot";
  // Re-parent every existing child onto the pivot. We slice the array
  // because group.children is mutated by `add`.
  for (const child of group.children.slice()) {
    pivot.add(child);
  }
  group.add(pivot);
  const rootUuid = pivot.uuid;
  if (!group.name) group.name = "enemy-root";

  // --- idle: gentle breath bob on y ------------------------------------
  // 1.5s loop, ±0.04 u on the y-position. Reads as "alive but holding".
  const idleY = new THREE.NumberKeyframeTrack(
    `${rootUuid}.position[y]`,
    [0, 0.75, 1.5],
    [0, 0.04, 0],
  );
  const idle = new THREE.AnimationClip("idle", 1.5, [idleY]);

  // --- walk: faster bob + a small yaw sway ------------------------------
  // 0.6s loop. Higher-amplitude vertical (a marching gait) + a yaw wiggle
  // that reads as the body shifting weight side to side.
  const walkY = new THREE.NumberKeyframeTrack(
    `${rootUuid}.position[y]`,
    [0, 0.15, 0.3, 0.45, 0.6],
    [0, 0.08, 0, 0.08, 0],
  );
  const walkRotY = new THREE.NumberKeyframeTrack(
    `${rootUuid}.rotation[y]`,
    [0, 0.15, 0.3, 0.45, 0.6],
    [0, 0.12, 0, -0.12, 0],
  );
  const walk = new THREE.AnimationClip("walk", 0.6, [walkY, walkRotY]);

  // --- attack: sharp forward lunge on z + pitch dip ---------------------
  // 0.4s one-shot feel (still loops at the mixer level — the engine swaps
  // back to walk when state leaves 'attacking'). Pitch (rotation x) tips
  // the upper body forward for the strike.
  const attackZ = new THREE.NumberKeyframeTrack(
    `${rootUuid}.position[z]`,
    [0, 0.1, 0.25, 0.4],
    [0, -0.18, 0.05, 0],
  );
  const attackRotX = new THREE.NumberKeyframeTrack(
    `${rootUuid}.rotation[x]`,
    [0, 0.1, 0.25, 0.4],
    [0, -0.3, 0.1, 0],
  );
  const attack = new THREE.AnimationClip("attack", 0.4, [attackZ, attackRotX]);

  // --- death: collapse — scale y → 0.1, fall to the floor ---------------
  // 0.8s, NOT looping (clamp at the floor). The engine flips the active
  // clip to 'death' the tick an enemy dies; the model is removed from the
  // scene a tick later (see Engine.damageEnemy), so the death anim is read
  // as a single beat. We use a VectorKeyframeTrack on scale to drive the
  // squash uniformly.
  const deathScale = new THREE.VectorKeyframeTrack(
    `${rootUuid}.scale`,
    [0, 0.4, 0.8],
    [1, 1, 1, 1, 0.6, 1, 1, 0.1, 1],
  );
  const deathRotZ = new THREE.NumberKeyframeTrack(
    `${rootUuid}.rotation[z]`,
    [0, 0.4, 0.8],
    [0, 0.6, 1.4],
  );
  const death = new THREE.AnimationClip("death", 0.8, [deathScale, deathRotZ]);

  const mixer = new THREE.AnimationMixer(group);
  const clips: Record<EnemyClipName, THREE.AnimationClip> = {
    idle,
    walk,
    attack,
    death,
  };
  const actions: Record<EnemyClipName, THREE.AnimationAction> = {
    idle: mixer.clipAction(idle),
    walk: mixer.clipAction(walk),
    attack: mixer.clipAction(attack),
    death: mixer.clipAction(death),
  };
  // Death is a one-shot: clamp on the last frame, don't snap back.
  actions.death.setLoop(THREE.LoopOnce, 1);
  actions.death.clampWhenFinished = true;
  // Boot every enemy on its idle loop. Other actions are weighted to 0;
  // setActiveClip swaps weights via fade so we never see a T-pose.
  actions.idle.play();
  actions.walk.play();
  actions.walk.weight = 0;
  actions.attack.play();
  actions.attack.weight = 0;
  // Death stays parked until the engine starts it explicitly (so the death
  // pose isn't held on a freshly-spawned enemy).
  return { mixer, clips, actions, active: "idle" };
}

/** Switch the rig's active clip with a short cross-fade. Idempotent — calling
 *  with the already-active name is a no-op. Called by the engine when an
 *  enemy's AI state changes (see engine.ts update()). */
export function setActiveClip(
  rig: EnemyAnimationRig,
  name: EnemyClipName,
): void {
  if (rig.active === name) return;
  const next = rig.actions[name];
  // Death is one-shot: rewind + restart so a re-kill (or stage reload) plays
  // the collapse fresh instead of holding the clamped end pose.
  if (name === "death") {
    next.reset();
    next.play();
  }
  // Cross-fade: ramp every other action's weight to 0, ramp the new one to 1.
  // The weight-snap below is a simpler equivalent of `crossFadeTo` for the
  // scaffold — mixer-internal cross-fades require the outgoing action to
  // have non-zero weight, which isn't guaranteed here. When the rig gains
  // an explicit cross-fade pass we'll switch to `crossFadeTo` with a
  // duration constant.
  for (const key of Object.keys(rig.actions) as EnemyClipName[]) {
    const action = rig.actions[key];
    if (key === name) {
      action.enabled = true;
      action.setEffectiveWeight(1);
    } else {
      action.setEffectiveWeight(0);
    }
  }
  rig.active = name;
}

/** Dispose every geometry + material in `group` — called when the engine
 *  removes a dead enemy from the scene. Walks the children once; each
 *  builder constructs its own geometries so there's no shared cache to
 *  protect. */
export function disposeEnemyModel(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        for (const m of mat) m.dispose();
      } else if (mat) {
        mat.dispose();
      }
    }
  });
}
