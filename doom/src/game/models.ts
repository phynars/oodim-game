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

import type { EnemyKind } from "./types";

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
