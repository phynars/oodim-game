# Doom enemy-hit juice — implementation spec (Refs #166)

This document is the implementation contract for issue #166 — the first
juice slice in `doom/`. It is the SPEC; the code change lives in a
follow-up PR by an implementer. Every numeric constant, decay order,
and acceptance assertion lives here so the implementer doesn't need to
re-derive them.

## The gap

`doom/src/game/engine.ts` `fireShot()` → `damageEnemy()`:
- decrements hp, plays `audio.playEnemyHit()`, on lethal switches the
  rig to `death`.
- renders the IDLE/WALK pose for the next tick.
- discards the THREE.Intersection's `hit.point` and `hit.face.normal`.

The taking-damage side has full juice (#91 — red flash + camera shake
on `damagePlayer`). The giving-damage side has none. From the player's
POV the gun acoustically connects but the world says nothing.

## State surface (new fields on DoomState + Enemy)

Doom's convention is **flat** — feedback lives directly on `DoomState`,
not inside a `FeedbackChannel` wrapper. `window.__doom` IS the state.

`doom/src/game/types.ts`:

```ts
// Per-enemy emissive flash on landing a hit. Decays 1 tick per
// fixed-step while hitstopTicks===0. 6 ticks @60Hz ≈ 100ms.
export const ENEMY_HIT_FLASH_TICKS = 6;

// Global hitstop on every landed hit. Multiple hits in one tick CLAMP
// via Math.max — they MUST NOT accumulate via +=. 2 ticks ≈ 33ms.
export const HITSTOP_TICKS_ON_HIT = 2;

// Camera micro-kick on connect (parallel to #91's damagePlayer shake).
// Half amplitude of SHAKE_AMPLITUDE so it reads as a "thump" not a
// "hit you took". Phase offset from the existing damage shake so the
// two don't perfectly align when both fire same tick.
export const HIT_SHAKE_TICKS = 3;
export const HIT_SHAKE_AMPLITUDE_FACTOR = 0.5;

// World-space impact sparks at hit.point. 6 sparks, 18-tick life
// (~300ms), gravity 0.005/tick on .y. Spawn offsets from a fixed
// table → deterministic e2e.
export const IMPACT_SPARK_COUNT = 6;
export const IMPACT_SPARK_LIFETIME = 18;
export const IMPACT_SPARK_GRAVITY = 0.005;
export const IMPACT_SPARK_BASE_SPEED = 0.08;

// Non-lethal flinch knock back along the shot direction, clamped by
// collidesAt so the enemy can't tunnel walls. Lethal hits SKIP this
// — the death rig owns positioning that frame.
export const FLINCH_KNOCK_WORLD_UNITS = 0.08;

// Fixed offset table for spark velocities (deterministic). 6 entries,
// each unit-length, in the plane perpendicular to face.normal. The
// engine rotates the table to align with the hit normal at spawn.
export const SPARK_OFFSET_TABLE: ReadonlyArray<readonly [number, number, number]> = [
  [ 1.0,  0.3,  0.0],
  [ 0.5,  0.5,  0.866],
  [-0.5,  0.7,  0.866],
  [-1.0,  0.3,  0.0],
  [-0.5,  0.5, -0.866],
  [ 0.5,  0.7, -0.866],
];

// On Enemy:
//   hitFlashTicks: number   // default 0; bumped to ENEMY_HIT_FLASH_TICKS on damage

// On DoomState:
//   hitstopTicks: number                       // default 0
//   hitShakeTicks: number                      // default 0
//   impactSparks: ImpactSpark[]                // default []
//
// type ImpactSpark = {
//   x: number; y: number; z: number;
//   vx: number; vy: number; vz: number;
//   ticksLeft: number;
// }
```

## Engine wiring (`doom/src/game/engine.ts`)

### `fireShot()` — capture intersection geometry

Currently the function calls `intersectObjects(...)`, reads
`intersections[0]`, and ONLY uses `hit.object.userData.enemyId`. It
needs to additionally capture:

```ts
const hitPoint = hit.point.clone();           // world-space
const hitNormal = (hit.face?.normal ?? new THREE.Vector3(0, 0, 1)).clone();
```

Then, AFTER the existing `damageEnemy(idx, PLAYER_SHOT_DAMAGE)` and
`state.hits.push(...)` calls, but only when the enemy survived (i.e.
`this.state.enemies[idx].state !== 'dead'` after damageEnemy ran):

```ts
this.applyFlinchKnock(idx, dir);   // dir = shot unit vector (already computed above)
```

Then UNCONDITIONALLY (lethal or not):

```ts
this.spawnImpactSparks(hitPoint, hitNormal);
// CLAMP — never +=
this.state.hitstopTicks = Math.max(this.state.hitstopTicks, HITSTOP_TICKS_ON_HIT);
this.state.hitShakeTicks = Math.max(this.state.hitShakeTicks, HIT_SHAKE_TICKS);
```

The per-enemy flash bump lives inside `damageEnemy` (next section) so
that ANY damage path (current hitscan + future projectile-on-enemy)
inherits the flash for free.

### `damageEnemy(idx, damage)` — bump the flash

Add immediately after the `e.hp -= damage` line:

```ts
e.hitFlashTicks = ENEMY_HIT_FLASH_TICKS;
```

This runs for both lethal and non-lethal damage. On the lethal frame
the flash + death rig both fire — the player sees "impact, then dies",
not "dies cleanly with no flash."

### `applyFlinchKnock(idx, shotDir)` — new private method

```ts
private applyFlinchKnock(idx: number, shotDir: THREE.Vector3): void {
  const e = this.state.enemies[idx];
  if (!e || e.state === 'dead') return;          // lethal owns positioning
  const nextX = e.x + shotDir.x * FLINCH_KNOCK_WORLD_UNITS;
  const nextZ = e.z + shotDir.z * FLINCH_KNOCK_WORLD_UNITS;
  // Same collision test movement uses. PLAYER_RADIUS overshoots a
  // little vs. enemy radius but the value is conservative — we'd
  // rather under-knock than tunnel.
  if (!collidesAt(nextX, e.z, PLAYER_RADIUS)) e.x = nextX;
  if (!collidesAt(e.x, nextZ, PLAYER_RADIUS)) e.z = nextZ;
}
```

### `spawnImpactSparks(point, normal)` — new private method

```ts
private spawnImpactSparks(point: THREE.Vector3, normal: THREE.Vector3): void {
  // Build a basis (u, v) perpendicular to normal so the fixed offset
  // table — defined in the local tangent plane — rotates to align with
  // whichever face was hit.
  const n = normal.clone().normalize();
  // Pick any vector not parallel to n.
  const tmp = Math.abs(n.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(tmp, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();

  for (const [tu, tn, tv] of SPARK_OFFSET_TABLE) {
    // Velocity = (tu * u + tn * n + tv * v) * BASE_SPEED — spreads
    // outward along the face's tangent plane, biased slightly along n
    // so sparks "bounce off" the surface rather than slide along it.
    const vx = (u.x * tu + n.x * tn + v.x * tv) * IMPACT_SPARK_BASE_SPEED;
    const vy = (u.y * tu + n.y * tn + v.y * tv) * IMPACT_SPARK_BASE_SPEED;
    const vz = (u.z * tu + n.z * tn + v.z * tv) * IMPACT_SPARK_BASE_SPEED;
    this.state.impactSparks.push({
      x: point.x, y: point.y, z: point.z,
      vx, vy, vz,
      ticksLeft: IMPACT_SPARK_LIFETIME,
    });
  }
}
```

### `update()` — gate order is LOAD-BEARING

At the TOP of the existing `if (this.state.status === 'playing')`
block, BEFORE `state.tick += 1`:

```ts
if (this.state.status === 'playing') {
  // HITSTOP GATE — frozen frames skip simulation BUT renderer keeps
  // drawing so the flash + sparks are visibly suspended.
  // Decrement here so the gate self-clears.
  if (this.state.hitstopTicks > 0) {
    this.state.hitstopTicks -= 1;
    // Do NOT decay anything else. Do NOT step sparks. Do NOT advance
    // tick. Renderer (called outside update()) still draws this frame
    // and the next, so the player sees a freeze.
    return;  // exits update() entirely
  }

  this.state.tick += 1;

  // Existing decays — now correctly guarded by the fact that
  // hitstopTicks===0 if we reached here.
  if (this.state.hitFlashTicks > 0) this.state.hitFlashTicks -= 1;
  if (this.state.shakeTicks > 0) this.state.shakeTicks -= 1;
  if (this.state.hitShakeTicks > 0) this.state.hitShakeTicks -= 1;
  for (const e of this.state.enemies) {
    if (e.hitFlashTicks > 0) e.hitFlashTicks -= 1;
  }

  // ... existing input / move / pickups / doors / exit / AI /
  // projectiles / viewmodel blocks ...

  // Step impact sparks (after the existing projectile block, before
  // the viewmodel block — keeps the per-tick allocation cluster
  // together).
  this.stepImpactSparks();
}
```

**Why `return` inside the playing block, not a guard around the
playing block?** Because the `'lost' → 'gameover'` advance + the
enemy-cull pass live OUTSIDE the playing block and MUST run during
hitstop (a hit that kills an enemy on the same tick the player dies
needs the cull to still happen, otherwise the rig leaks for the
page's lifetime). The early `return` is from update() entirely — that
matches the existing structure where the cull runs after the playing
block too. **Implementer: verify by reading the file — if cull
sits inside playing block, refactor the gate accordingly.**

### `stepImpactSparks()` — new private method

```ts
private stepImpactSparks(): void {
  if (this.state.impactSparks.length === 0) return;
  const survivors: ImpactSpark[] = [];
  for (const s of this.state.impactSparks) {
    s.x += s.vx;
    s.y += s.vy;
    s.z += s.vz;
    s.vy -= IMPACT_SPARK_GRAVITY;
    s.ticksLeft -= 1;
    if (s.ticksLeft > 0) survivors.push(s);
  }
  this.state.impactSparks = survivors;
}
```

### `syncCamera()` — additive hit-shake contribution

The existing block computes `ox`/`oy` from `shakeTicks`. Add a
parallel contribution from `hitShakeTicks` at half amplitude, with a
phase offset so when both fire same tick they don't perfectly stack:

```ts
if (this.state.hitShakeTicks > 0) {
  const k = this.state.hitShakeTicks / HIT_SHAKE_TICKS;
  const phase = this.state.tick;
  // Different phase coefficients (1.3 / 2.9) than the damage shake's
  // (1.7 / 2.3) so the two beats are visibly distinct in motion.
  ox += Math.sin(phase * 1.3) * SHAKE_AMPLITUDE * HIT_SHAKE_AMPLITUDE_FACTOR * k;
  oy += Math.cos(phase * 2.9) * SHAKE_AMPLITUDE * HIT_SHAKE_AMPLITUDE_FACTOR * k;
}
```

### `render()` — emissive bump per flashed enemy + spark pool

Per-enemy flash bump (after the position-sync loop):

```ts
for (const e of this.state.enemies) {
  const model = this.enemyMeshes.get(e.id);
  if (!model) continue;
  const intensity = e.hitFlashTicks > 0
    ? 0.7 * (e.hitFlashTicks / ENEMY_HIT_FLASH_TICKS)
    : 0;
  model.traverse((child) => {
    const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!mat || !mat.emissive) return;
    // Stash the base emissive once on userData so we can restore.
    if (mat.userData.baseEmissive === undefined) {
      mat.userData.baseEmissive = mat.emissive.clone();
    }
    const base = mat.userData.baseEmissive as THREE.Color;
    mat.emissive.setRGB(
      base.r + (1 - base.r) * intensity,
      base.g + (1 - base.g) * intensity,
      base.b + (1 - base.b) * intensity,
    );
  });
}
```

Spark pool — allocate ONCE at boot, hide unused:

- In the constructor, after seeding enemies, allocate
  `IMPACT_SPARK_COUNT * 4` small bright-orange Meshes (small pool
  buffer for overlap). Store in `this.sparkPool: THREE.Mesh[]`.
- In `render()`, after the per-enemy block, walk the pool and the
  `state.impactSparks` in parallel: for each spark, position the
  next pool mesh + `visible = true`; for the rest, `visible = false`.

```ts
// Boot — once:
const sparkGeo = new THREE.SphereGeometry(0.04, 6, 4);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
for (let i = 0; i < IMPACT_SPARK_COUNT * 4; i++) {
  const m = new THREE.Mesh(sparkGeo, sparkMat);
  m.visible = false;
  this.scene.add(m);
  this.sparkPool.push(m);
}

// Render — per frame:
for (let i = 0; i < this.sparkPool.length; i++) {
  const mesh = this.sparkPool[i];
  const spark = this.state.impactSparks[i];
  if (!spark) {
    mesh.visible = false;
    continue;
  }
  mesh.visible = true;
  mesh.position.set(spark.x, spark.y, spark.z);
  const k = spark.ticksLeft / IMPACT_SPARK_LIFETIME;
  mesh.scale.setScalar(k);  // linear shrink
}
```

## E2E (`doom/e2e/doom.spec.ts`)

Mirror the muzzle-flash assertion pattern (lines 973-994). New test —
add alongside the existing fire test:

```ts
test('hitscan connect publishes hitstop + sparks + per-enemy flash + hit-shake', async ({ page }) => {
  await page.goto('/doom');
  await page.waitForFunction(() => Boolean(window.__doom));
  await page.keyboard.press('Space');  // boot to playing

  // Pick a non-lethal-on-one-hit enemy so flinch knock fires.
  // The demon has hp > PLAYER_SHOT_DAMAGE.
  const demonId = await page.evaluate(() => {
    return window.__doom!.enemies.find((e) => e.kind === 'demon')!.id;
  });

  const before = await page.evaluate(() => ({
    hitstop: window.__doom!.hitstopTicks,
    sparks: window.__doom!.impactSparks.length,
    hitShake: window.__doom!.hitShakeTicks,
  }));
  expect(before.hitstop).toBe(0);
  expect(before.sparks).toBe(0);
  expect(before.hitShake).toBe(0);

  await page.evaluate((id) => {
    window.__doomInternals!.forceHit({ enemyId: id });
  }, demonId);

  // Same synchronous publish — all four assertions must hold.
  const after = await page.evaluate((id) => {
    const enemy = window.__doom!.enemies.find((e) => e.id === id)!;
    return {
      hitstop: window.__doom!.hitstopTicks,
      sparks: window.__doom!.impactSparks.length,
      hitShake: window.__doom!.hitShakeTicks,
      enemyFlash: enemy.hitFlashTicks,
    };
  }, demonId);
  expect(after.hitstop).toBeGreaterThan(0);  // === HITSTOP_TICKS_ON_HIT
  expect(after.sparks).toBe(6);              // === IMPACT_SPARK_COUNT
  expect(after.hitShake).toBeGreaterThan(0);
  expect(after.enemyFlash).toBe(6);          // === ENEMY_HIT_FLASH_TICKS

  // Hitstop freezes sparks. Advance exactly HITSTOP_TICKS_ON_HIT
  // ticks; sparks should still be at full count + position frozen.
  const frozenSparkPositions = await page.evaluate(() => {
    return window.__doom!.impactSparks.map((s) => ({ x: s.x, y: s.y, z: s.z }));
  });
  await page.evaluate(() => {
    window.__doomInternals!.advance({ steps: 2 });  // === HITSTOP_TICKS_ON_HIT
  });
  const duringHitstop = await page.evaluate(() => ({
    sparks: window.__doom!.impactSparks.length,
    positions: window.__doom!.impactSparks.map((s) => ({ x: s.x, y: s.y, z: s.z })),
  }));
  expect(duringHitstop.sparks).toBe(6);
  // Byte-identical positions during freeze.
  expect(duringHitstop.positions).toEqual(frozenSparkPositions);

  // One more tick — hitstop now expired; sparks step forward AND
  // their lifetime decrements.
  await page.evaluate(() => {
    window.__doomInternals!.advance({ steps: 1 });
  });
  const afterFreeze = await page.evaluate(() => ({
    hitstop: window.__doom!.hitstopTicks,
    sparkPositionMoved: window.__doom!.impactSparks[0]?.x !== frozenSparkPositions[0]?.x
      || window.__doom!.impactSparks[0]?.y !== frozenSparkPositions[0]?.y
      || window.__doom!.impactSparks[0]?.z !== frozenSparkPositions[0]?.z,
  }));
  expect(afterFreeze.hitstop).toBe(0);
  expect(afterFreeze.sparkPositionMoved).toBe(true);
});
```

## Burns this spec bakes in (Diego's past learnings)

1. **`Math.max`, never `+=`.** Multi-hit futures (shotgun, splash)
   would otherwise freeze the engine indefinitely. Galaga taught this
   the hard way.
2. **Decay AFTER the gate decrement, gated on hitstopTicks===0.**
   Frozen frames must not age the flash OR step the sparks. The early
   `return` inside the playing block enforces this structurally.
3. **Determinism via fixed offset table.** `SPARK_OFFSET_TABLE` is six
   literal entries; no `Math.random` anywhere on the simulation path.
   E2E asserts on counts AND byte-identical positions during hitstop.
4. **Flat surface, not wrapped FeedbackChannel.** `doom/` publishes
   `DoomState` as `window.__doom` directly — feedback fields live on
   the state itself. Same architectural pattern as pacman/galaga, flat
   surface convention.
5. **Lethal-hit suppresses flinch knock.** The death rig owns
   positioning on the death frame; a knock would fight the death-anim
   pose. The flash still fires (player sees the impact register before
   the body drops).
6. **Spark pool allocated ONCE.** No per-hit Mesh/Geometry/Material
   allocations — only the small ImpactSpark plain-object array grows.

## Out of scope (follow-up issues)

- Wall-impact sparks/decals on misses or wall-stop (this slice = enemy
  hits only).
- Lethal-hit AMPLIFICATION: larger hitstop (4 frames) + extra sparks +
  gore on kill — separate issue, the Doom counterpart to galaga #160.
- HUD damage-number popups (`-50` floats off the enemy) — separate
  pickup/feedback issue.
- Audio duck on hitstop (briefly attenuate ambience during freeze) —
  audio team's call.
